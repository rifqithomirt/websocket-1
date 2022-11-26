const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'test.chotoni123',
        pass: 'pnchnwnqqogegcgl'
    }
});

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
                    <span>${obj.created_at}</span>
                </div>
            </div>
            <p style="font-size:14px;">Unfortunately, this email is an automated notification, which is unable to receive replies.</p>
        </div>
    </div>`
}

exports.send = async function( message ) {
    try {
        const result = await transporter.sendMail({
            from: 'test.chotoni123',
            to: 'rifqi.arti.rt@gmail.com',
            subject: message.subject,
            // text: message.text,
            html: funTemplate(message)
        });
        return result
    } catch (ex) {
        return ex
    }
};