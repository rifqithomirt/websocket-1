const Modbus = require('jsmodbus')
const net = require('net')
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http, {cors: {origin: "*"}});
const mysql = require('mysql2');
const EventEmitter = require('events');
const dotenv = require('dotenv')

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

// Mysql Pool
const pool = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  port: 3307,
  database: 'cold_storage',
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0
});

// Mysql Emit
emitData.on('save', (obj) => {
    var strValues = obj.map(row => {
        return `('${row.label}', '${row.value}', '${new Date().toISOString()}')`
    }).join(',');
    pool.query(`INSERT INTO logging (name, value, created_at) VALUES ${strValues};`, function(err, rows, fields) {
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
bot.start();
// bot.sendMessage(telid, 'Bot Started');

// Telegram Emit
emitData.on('telegram', (value) => {
    // console.log('bot')
    // bot.sendMessage(telid, value);
});

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

// Main Function Reading Register
var main1 = async function() {
    // console.log('loop1', connected1)
    if( connected1 ) {
        client1.readHoldingRegisters(process.env.TEMP1, 2).then(function (result) {
            var arrData = result.response._body._values
            var objData = [ 
                {label: 'Temperature1', value: arrData[0], created_at: new Date().toISOString()}, 
                {label: 'Temperature2', value: arrData[1], created_at: new Date().toISOString()},
            ]
            emitData.emit('save', objData);
            io.emit(room, JSON.stringify(objData));
            console.log(arrData, '1')
            setTimeout(main1, options[0].loop)
        }, function(error){
            
            var objData = [ 
                {label: 'Temperature1', error: 'Komunikasi Error', message: JSON.stringify(error)},
                {label: 'Temperature2', error: 'Komunikasi Error', message: JSON.stringify(error)},
            ]
            io.emit(room, JSON.stringify(objData));
            // console.log(error, 'err')
            setTimeout(main1, options[0].loop)
        });

        try {
            var resultAlarmHigh = await client1.readCoils(process.env.ALARMHIGH1, 2);
            var resultAlarmLow = await client1.readCoils(process.env.ALARMLOW1, 2);

            var alarmHigh = resultAlarmHigh.response._body._valuesAsArray
            var alarmLow = resultAlarmLow.response._body._valuesAsArray

            
            var objData = []
            if( alarmHigh[0] ) objData.push({label: 'AlarmHigh1', value: alarmHigh[0], created_at: new Date().toISOString()})
            if( alarmHigh[1] ) objData.push({label: 'AlarmHigh2', value: alarmHigh[1], created_at: new Date().toISOString()})
            if( alarmLow[0] ) objData.push({label: 'AlarmLow1', value: alarmHigh[0], created_at: new Date().toISOString()})
            if( alarmLow[1] ) objData.push({label: 'AlarmLow2', value: alarmHigh[1], created_at: new Date().toISOString()})
            io.emit(alarm, JSON.stringify(objData));
            emitData.emit('telegram', JSON.stringify(objData))
        } catch (err) {
            console.log(err)

        }
    } else {
        var objData = [ 
            {label: 'Temperature1', error: 'Komunikasi Terputus' },
            {label: 'Temperature2', error: 'Komunikasi Terputus' },
        ]
        io.emit(room, JSON.stringify(objData));
        setTimeout(main1, options[0].loop)
    }
}
var main2 = async function() {
    // console.log('loop')
    if( connected2 ) {
        client2.readHoldingRegisters(process.env.TEMP2, 2).then(function (result) {
            var arrData = result.response._body._values
            var objData = [ 
                {label: 'Temperature3', value: arrData[0], created_at: new Date().toISOString()},
                {label: 'Temperature4', value: arrData[1], created_at: new Date().toISOString()},
            ]
            emitData.emit('save', objData);
            io.emit(room, JSON.stringify(objData));
            console.log(arrData, '2')
            setTimeout(main2, options[0].loop)
        }, function(error){
            var objData = [ 
                {label: 'Temperature3', error: 'Komunikasi Error', message: JSON.stringify(error)},
                {label: 'Temperature4', error: 'Komunikasi Error', message: JSON.stringify(error)},
            ]
            io.emit(room, JSON.stringify(objData));
            // console.log(error, 'err')
            setTimeout(main2, options[0].loop)
        });

        try {
            var resultAlarmHigh = await client1.readCoils(process.env.ALARMHIGH2, 2);
            var resultAlarmLow = await client1.readCoils(process.env.ALARMLOW2, 2);

            var alarmHigh = resultAlarmHigh.response._body._valuesAsArray
            var alarmLow = resultAlarmLow.response._body._valuesAsArray

            
            var objData = []
            if( alarmHigh[0] ) objData.push({label: 'AlarmHigh3', value: alarmHigh[0], created_at: new Date().toISOString()})
            if( alarmHigh[1] ) objData.push({label: 'AlarmHigh4', value: alarmHigh[1], created_at: new Date().toISOString()})
            if( alarmLow[0] ) objData.push({label: 'AlarmLow3', value: alarmHigh[0], created_at: new Date().toISOString()})
            if( alarmLow[1] ) objData.push({label: 'AlarmLow4', value: alarmHigh[1], created_at: new Date().toISOString()})
            io.emit(alarm, JSON.stringify(objData));
            emitData.emit('telegram', JSON.stringify(objData))
        } catch (err) {
            console.log(err)

        }
    } else {
        var objData = [ 
            {label: 'Temperature3', error: 'Komunikasi Terputus' },
            {label: 'Temperature4', error: 'Komunikasi Terputus' },
        ]
        io.emit(room, JSON.stringify(objData));
        // console.log(connected2, 'connected')
        setTimeout(main2, options[0].loop)
    }
}

// Execute Modbus
connect(1)
connect(2)
main1()
main2()

// http for Socket IO
http.listen(port, () => {
    console.log(`Socket.IO server running at http://localhost:${port}/`);
});
