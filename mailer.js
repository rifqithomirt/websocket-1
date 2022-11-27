const nodemailer = require('nodemailer');

var funTemplate = function(obj){
    return `
        <div style="margin-left:20px; margin-right:20px;">
        <div style="display: flex; align-items: center;">
            <h2>${obj.subject}</h2>
        </div>
        <div>
            <div style="background-color: #d7d9d7; padding: 5px 5px 20px 20px; border-radius: 10px;">
                <p>${obj.text}</p>
                <div style="margin: 2px; display: flex;">
                    <span style="width: 4rem;">Value</span>:&nbsp;
                    <span>${obj.value}</span>
                    <span>&#8451;</span>
                </div>
                <div style="margin: 2px; display: flex;">
                    <span style="width: 4rem;">Date</span>:&nbsp;
                    <span>${obj.alert_time.substr(0,19).replace('T', ' ')}</span>
                </div>
            </div>
            <p style="font-size:14px;">Unfortunately, this email is an automated notification, which is unable to receive replies.</p>
        </div>
    </div>`
}

exports.send = async function( message ) {
    try {
        console.log(message)
        let transporter = nodemailer.createTransport({
            host: message.host,
            port: message.port,
            secure: false,
            // auth: {
            //     user: 'rifqithomi@chotoni.id', // generated ethereal user
            //     pass: 'rifqithomi123-', // generated ethereal password
            // },
            tls: {rejectUnauthorized: false} 
        });
        let result = await transporter.sendMail({
            from: message.from,
            to: message.to,
            subject: message.subject,
            // text: message.text,
            html: funTemplate(message)
        });
        console.log(result)
        return result
    } catch (ex) {
        console.log(ex)
        return ex
    }
};