const e = require("express");
var modbus = require("modbus-stream");
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http, {cors: {origin: "*"}});
const port = process.env.PORT || 3000;
const room = "data";

http.listen(port, () => {
    console.log(`Socket.IO server running at http://localhost:${port}/`);
});

var mconnect = async function (option) {
    return new Promise((resolve, reject) => {
        modbus.tcp.connect(option.PORT, option.HOST , async (err, connection) => {
            if( !err ) resolve(connection);
            else reject(err)
        });
    });
}

var read = async function (conn, objAddress) {
    return new Promise((resolve, reject) => {
        conn.readHoldingRegisters(objAddress, (err, res) => {
            if(!err) resolve(res);
            else reject(err)
        })
    });
}

let connection = null

var main = async function(){
    var option = {
        HOST: '127.0.0.1',
        PORT: 502,
    }
    try {
        var objAddress = { address: 0, quantity: 2, extra: { unitId: 1 } };
        if( !connection ) connection = await mconnect(option);
        try {
            var result = await read( connection, objAddress )
            var objResult =  [
                {data: 'Temperature 1', value: result.response.data[0].readInt16BE(0)},
                {data: 'Temperature 2', value: result.response.data[1].readInt16BE(0)},
            ]
            console.log(objResult)
            setTimeout(main, 5000)
        } catch (ex) {
            console.log(ex, 'read')
            connection = null
            setTimeout(main, 5000)
        }
        
    } catch(ex) {
        console.log(ex, 'conn')
        connection = null
        setTimeout(main, 5000)
    }
}

main()


// modbus.tcp.connect(502, "127.0.0.1" , async (err, connection) => {
//     var option = { address: 0, quantity: 2, extra: { unitId: 1 } };
//     var loop = function() {
//         connection.readHoldingRegisters(option, (err, res) => {
//             if (err) {
//                 setTimeout( loop, 5000 )
//                 console.log(err);
//             } else {
//                 io.emit(room, JSON.stringify([
//                     {data: 'Temperature 1', value: res.response.data[0].readInt16BE(0)},
//                     {data: 'Temperature 2', value: res.response.data[1].readInt16BE(0)},
//                 ]));
//                 setTimeout( loop, 5000 )
//             }
//         })
//     }
//     loop();
// });

