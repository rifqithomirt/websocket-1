const Modbus = require('jsmodbus')
const net = require('net')
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http, {cors: {origin: "*"}});
const mysql = require('mysql2');
const EventEmitter = require('events');

var socket1 = new net.Socket()
var socket2 = new net.Socket()
class Emitter extends EventEmitter {}
const emitData = new Emitter();

// Variable Config
const unitId = 1
const port = process.env.PORT || 3000;
const room = "data";
var intervalConnect1 = false;
var intervalConnect2 = false;
var connected1 = false
var connected2 = false
var client1 = new Modbus.client.TCP(socket1, unitId)
var client2 = new Modbus.client.TCP(socket2, unitId)
const options = [{
    'host' : '192.168.100.9',
    'port' : 502,
    'retry': 10000,
    'loop' : 5000
}, {
    'host' : '192.168.100.6',
    'port' : 502,
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
bot.sendMessage(telid, 'Bot Started');

// Telegram Emit
emitData.on('telegram', (value) => {
    // console.log('bot')
    bot.sendMessage(telid, value);
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
var main1 = function() {
    // console.log('loop1', connected1)
    if( connected1 ) {
        client1.readHoldingRegisters(0, 2).then(function (result) {
            var arrData = result.response._body._values
            var objData = [ 
                {label: 'Temperature 1', value: arrData[0], created_at: new Date().toISOString()}, 
                {label: 'Temperature 2', value: arrData[1], created_at: new Date().toISOString()},
            ]
            emitData.emit('save', objData);
            io.emit(room, JSON.stringify(objData));
            console.log(arrData, '1')
            setTimeout(main1, options[0].loop)
        }, function(error){
            
            var objData = [ 
                {label: 'Temperature 1', error: 'Komunikasi Error', message: JSON.stringify(error)},
                {label: 'Temperature 2', error: 'Komunikasi Error', message: JSON.stringify(error)},
            ]
            io.emit(room, JSON.stringify(objData));
            // console.log(error, 'err')
            setTimeout(main1, options[0].loop)
        });
    } else {
        var objData = [ 
            {label: 'Temperature 1', error: 'Komunikasi Terputus' },
            {label: 'Temperature 2', error: 'Komunikasi Terputus' },
        ]
        io.emit(room, JSON.stringify(objData));
        setTimeout(main1, options[0].loop)
    }
}
var main2 = function() {
    // console.log('loop')
    if( connected2 ) {
        client2.readHoldingRegisters(0, 2).then(function (result) {
            var arrData = result.response._body._values
            var objData = [ 
                {label: 'Temperature 3', value: arrData[0], created_at: new Date().toISOString()},
                {label: 'Temperature 4', value: arrData[1], created_at: new Date().toISOString()},
            ]
            emitData.emit('save', objData);
            io.emit(room, JSON.stringify(objData));
            console.log(arrData, '2')
            setTimeout(main2, options[0].loop)
        }, function(error){
            var objData = [ 
                {label: 'Temperature 3', error: 'Komunikasi Error', message: JSON.stringify(error)},
                {label: 'Temperature 4', error: 'Komunikasi Error', message: JSON.stringify(error)},
            ]
            io.emit(room, JSON.stringify(objData));
            // console.log(error, 'err')
            setTimeout(main2, options[0].loop)
        });
    } else {
        var objData = [ 
            {label: 'Temperature 3', error: 'Komunikasi Terputus' },
            {label: 'Temperature 4', error: 'Komunikasi Terputus' },
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
