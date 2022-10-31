var modbus = require("modbus-stream");

modbus.tcp.connect(502, "127.0.0.1" , async (err, connection) => {
    var option = { address: 0, quantity: 2, extra: { unitId: 1 } };
    var loop = function() {
        connection.readHoldingRegisters(option, (err, res) => {
            if (err) {
                setTimeout( loop, 5000 )
                console.log(err);
            } else {
                setTimeout( loop, 5000 )
                console.log(res.response.data[0].readInt16BE(0));
                console.log(res.response.data[1].readInt16BE(0));
            }
        })
    }
    loop();
});