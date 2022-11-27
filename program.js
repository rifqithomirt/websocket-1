const Modbus = require('jsmodbus')
const net = require('net')
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http, {cors: {origin: "*"}});
const mysql = require('mysql2');
const EventEmitter = require('events');
const dotenv = require('dotenv')

const mailer = require('./mailer')

dotenv.config();
var socket1 = new net.Socket()
var socket2 = new net.Socket()
class Emitter extends EventEmitter {}
const emitData = new Emitter();

// Variable Config
const unitId = 1
const port = process.env.PORT || 3000;
const room = "data";
const alarm = "alarm";
var intervalConnect1 = false;
var intervalConnect2 = false;
var connected1 = false
var connected2 = false
var client1 = new Modbus.client.TCP(socket1, unitId)
var client2 = new Modbus.client.TCP(socket2, unitId)
const options = [{
    'host' : process.env.IP1,
    'port' : process.env.PORT1,
    'retry': 10000,
    'loop' : 5000
}, {
    'host' : process.env.IP2,
    'port' : process.env.PORT2,
    'retry': 10000,
    'loop' : 5000
}]
const telegramBot = '5856032986:AAHBYV-cSPxjrUOvzjlmlynFVLMHrIv-x-A'
const labels = [
    'Cold Storage Export 1',
    'Cold Storage Export 2',
    'Cold Storage Import 1',
    'Cold Storage Import 2',
]

// Mysql Pool
const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  port: 3306,
  password: process.env.DBPASSWORD || '',
  database: process.env.DATABASE || 'coldstorage',
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0
});

// Mysql Emit
emitData.on('save', (obj) => {
    // var strValues = obj.map(row => {
    //     return `('${row.label}', '${row.value}', '${row.created_at}')`
    // }).join(',');
    // pool.query(`INSERT INTO logging (name, value, created_at) VALUES ${strValues};`, function(err, rows, fields) {
    //   if(err) console.log(err)
    // })
    var strValues = `('${obj.value1}', '${obj.value2}', '${obj.value3}', '${obj.value4}', '${obj.created_at}')`
    pool.query(`INSERT INTO logging ( value1, value2, value3, value4, created_at) VALUES ${strValues};`, function(err, rows, fields) {
      if(err) console.log(err)
    })
});

// Function for Telegram
var TeleBot = require('telebot');
var bot = new TeleBot({
    token: telegramBot,
    polling: { // Optional. Use polling.
        interval: 1000, // Optional. How often check updates (in ms).
        timeout: 0, // Optional. Update polling timeout (0 - short polling).
        limit: 0, // Optional. Limits the number of updates to be retrieved.
        retryTimeout: 5000, // Optional. Reconnecting timeout (in ms).
    }
});
var telid = '-862629218'
// bot.start();
var emailed = [
    {'Cold Storage Export 1' : false},
    {'Cold Storage Export 2' : false},
    {'Cold Storage Import 1' : false},
    {'Cold Storage Import 2' : false},
]

var emailTime = 15 * 60 * 1000
// Email Emit
emitData.on('email', (value) => {
    console.log('alert')
    pool.query(`SELECT * FROM settings;`, function(err, rows, fields) {
        if(err) {
            console.log(err)
        } else {
            var emailSettings = rows[0]
            emailTime = emailSettings['interval'] * 60 * 1000

            if( emailSettings['notification'] == 'enable' ) {
                var arr = JSON.parse(value)
                arr.forEach((obj) => {
                    if( !emailed[obj.label] ) {
                        console.log('send' + obj.label)
                        var objEmail = Object.assign( {subject: 'Cold Storage Alert', text: obj.label, value: obj.value , alert_time: obj.created_at}, emailSettings)
                        mailer.send(objEmail)
                        emailed[obj.label] = true
                        setTimeout(function(){
                            emailed[obj.label] = false
                        }, emailTime)
                    }
                });
            }
        }
    })
    

    
    
});

//drift Time
function getNow() {
    return new Date(new Date().getTime() + (7 * 3600 * 1000)).toISOString()
}

// Functions for Modbus Communication 
function connect(index) {
    if( index == 1 ) socket1.connect(options[0])
    else socket2.connect(options[1])
}
function launchIntervalConnect(index) {
    // console.log('lounc', index)
    if( index == 1 ) {
        connected1 = false
        if(false != intervalConnect1) return
        intervalConnect1 = setInterval(function(){connect(index)}, options[0].retry)
    } else {
        connected2 = false
        if(false != intervalConnect2) return
        intervalConnect2 = setInterval(function(){connect(index)}, options[1].retry)
    }
    
}
function clearIntervalConnect(index) {
    if( index == 1 ) {
        if(false == intervalConnect1) return
        clearInterval(intervalConnect1)
        intervalConnect1 = false
    } else {
        if(false == intervalConnect2) return
        clearInterval(intervalConnect2)
        intervalConnect2 = false
    }
}

// Event Socket Modbus Communication
socket1.on('connect', function () {
    clearIntervalConnect(1)
    connected1 = true
}); 
socket2.on('connect', function () {
    clearIntervalConnect(2)
    connected2 = true
}); 
socket1.on('error', function (err) {
    console.log(err, 'error1')
});     
socket2.on('error', function (err) {
    console.log(err, 'error2')
    launchIntervalConnect(2)
});    

socket1.on('close', function(){
    launchIntervalConnect(1);
})
socket1.on('end', function(){
    launchIntervalConnect(1)
})
socket2.on('close', function(){
    launchIntervalConnect(2)
})
socket2.on('end', function(){
    launchIntervalConnect(2)
})

var temperatureData = {
    value1:null,
    value2:null,
    value3:null,
    value4:null,
}

// Main Function Reading Register
var main1 = async function() {
    console.log(connected1, 'loop1')
    if( connected1 ) {
        var objDataSend = [
            {value: '-'},
            {value: '-'},
        ]
        try {
            var temperature = await client1.readHoldingRegisters(process.env.TEMP1, 2)
            var arrData = [
                temperature.response._body._valuesAsBuffer.readInt16BE(0)*0.1,
                temperature.response._body._valuesAsBuffer.readInt16BE(2)*0.1
            ]

            var objData = [ 
                {label: labels[0], value: arrData[0].toFixed(1)*1, created_at: getNow()}, 
                {label: labels[1], value: arrData[1].toFixed(1)*1, created_at: getNow()},
            ]
            objDataSend = objData
            temperatureData['value1'] = arrData[0].toFixed(1)*1
            temperatureData['value2'] = arrData[1].toFixed(1)*1
            // emitData.emit('save', objData);
            io.emit(room, JSON.stringify(objData));
            setTimeout(main1, options[0].loop)
            // console.log(objData)
        } catch (error) {
            temperatureData['value1'] = null
            temperatureData['value2'] = null
            console.log(error)
            var objData = [ 
                {label: labels[0], error: 'Komunikasi Error', message: JSON.stringify(error)},
                {label: labels[1], error: 'Komunikasi Error', message: JSON.stringify(error)},
            ]
            io.emit(room, JSON.stringify(objData));
            setTimeout(main1, options[0].loop)
        }

        try {
            var resultAlarm = await client1.readHoldingRegisters(process.env.ALARM1, 2);
            var alarmHigh = [
                resultAlarm.response._body._valuesAsBuffer.readInt16BE(0) === 1,
                resultAlarm.response._body._valuesAsBuffer.readInt16BE(0) === 4
            ]
            var alarmLow = [
                resultAlarm.response._body._valuesAsBuffer.readInt16BE(2) === 1,
                resultAlarm.response._body._valuesAsBuffer.readInt16BE(2) === 4
            ]

            // console.log(alarmHigh, alarmLow, resultAlarm.response._body._valuesAsBuffer, '1')

            var objData = []
            if( alarmHigh[0] ) objData.push({label: 'Alarm ' + labels[0] + ' High', value: objDataSend[0]['value'], created_at: getNow()})
            if( alarmHigh[1] ) objData.push({label: 'Alarm ' + labels[1] + ' High', value: objDataSend[1]['value'], created_at: getNow()})
            if( alarmLow[0] ) objData.push({label: 'Alarm ' + labels[0] + ' Low', value: objDataSend[0]['value'], created_at: getNow()})
            if( alarmLow[1] ) objData.push({label: 'Alarm ' + labels[1] + ' Low', value: objDataSend[1]['value'], created_at: getNow()})
            
            if( objData.length > 0 ) {
                // console.log(objData)
                io.emit(alarm, JSON.stringify(objData));
                emitData.emit('email', JSON.stringify(objData))
            }

        } catch (error) {
            console.log(error)
            var objData = [ 
                {label: labels[0], error: 'Komunikasi Error', message: JSON.stringify(error)},
                {label: labels[1], error: 'Komunikasi Error', message: JSON.stringify(error)},
            ]
            io.emit(alarm, JSON.stringify(objData));
        }
    } else {
        
        temperatureData['value1'] = null
        temperatureData['value2'] = null
        var objData = [ 
            {label:labels[0], error: 'Komunikasi Terputus' },
            {label: labels[1], error: 'Komunikasi Terputus' },
        ]
        io.emit(room, JSON.stringify(objData));
        setTimeout(main1, options[0].loop)
    }
}
var main2 = async function() {
    console.log(connected2, 'loop2')
    if( connected2 ) {
        var objDataSend = [
            {value: '-'},
            {value: '-'},
        ]
        try {
            var temperature = await client2.readHoldingRegisters(process.env.TEMP2, 2);
            var arrData = [
                temperature.response._body._valuesAsBuffer.readInt16BE(0)*0.1,
                temperature.response._body._valuesAsBuffer.readInt16BE(2)*0.1
            ]
            var objData = [ 
                {label: labels[2], value: (arrData[0]).toFixed(1)*1, created_at: getNow()},
                {label: labels[3], value: (arrData[1]).toFixed(1)*1, created_at: getNow()},
            ]
            objDataSend = objData
            // emitData.emit('save', objData);
            temperatureData['value3'] = arrData[0].toFixed(1)*1
            temperatureData['value4'] = arrData[1].toFixed(1)*1
            io.emit(room, JSON.stringify(objData));
            setTimeout(main2, options[0].loop)
        } catch (error) {
            temperatureData['value3'] = null
            temperatureData['value4'] = null
            console.log(error)
            var objData = [ 
                {label: labels[2], error: 'Komunikasi Error', message: JSON.stringify(error)},
                {label: labels[3], error: 'Komunikasi Error', message: JSON.stringify(error)},
            ]
            io.emit(room, JSON.stringify(objData));
            setTimeout(main2, options[0].loop)
        }
        
        try {
            var resultAlarm = await client2.readHoldingRegisters(process.env.ALARM2, 2);
            var alarmHigh = [
                resultAlarm.response._body._valuesAsBuffer.readInt16BE(0) === 1,
                resultAlarm.response._body._valuesAsBuffer.readInt16BE(0) === 4
            ]
            var alarmLow = [
                resultAlarm.response._body._valuesAsBuffer.readInt16BE(2) === 1,
                resultAlarm.response._body._valuesAsBuffer.readInt16BE(2) === 4
            ]

            // console.log(alarmHigh, alarmLow, resultAlarm.response._body._valuesAsBuffer, '2')

            var objData = []
            if( alarmHigh[0] ) objData.push({label: 'Alarm ' + labels[2] + ' High', value: objDataSend[0]['value'], created_at: getNow()})
            if( alarmHigh[1] ) objData.push({label: 'Alarm ' + labels[3] + ' High', value: objDataSend[1]['value'], created_at: getNow()})
            if( alarmLow[0] ) objData.push({label: 'Alarm ' + labels[2] + ' Low', value: objDataSend[0]['value'], created_at: getNow()})
            if( alarmLow[1] ) objData.push({label: 'Alarm ' + labels[3] + ' Low', value: objDataSend[1]['value'], created_at: getNow()})
            if( objData.length > 0 ) {
                io.emit(alarm, JSON.stringify(objData));
                emitData.emit('email', JSON.stringify(objData))
            }
        } catch (error) {
            console.log(error)
            var objData = [ 
                {label: 'Alarm ' + labels[2], error: 'Komunikasi Error', message: JSON.stringify(error)},
                {label: 'Alarm ' + labels[3], error: 'Komunikasi Error', message: JSON.stringify(error)},
            ]
            io.emit(alarm, JSON.stringify(objData));
        }
    } else {
        
        temperatureData['value1'] = null
        temperatureData['value2'] = null
        var objData = [ 
            {label: labels[2], error: 'Komunikasi Terputus' },
            {label: labels[3], error: 'Komunikasi Terputus' },
        ]
        io.emit(room, JSON.stringify(objData));
        setTimeout(main2, options[0].loop)
    }
}

var loopSaveData = function(){
    var objData = Object.assign( {} , temperatureData)
    objData['created_at'] = getNow()
    emitData.emit('save', objData)
    setTimeout(function(){
        loopSaveData()
    }, 5000)
}

// Execute Modbus
connect(1)
connect(2)
main1()
main2()
setTimeout(function(){
    loopSaveData()
}, 7000)

// http for Socket IO
http.listen(port, () => {
    console.log(`Socket.IO server running at http://localhost:${port}/`);
});
