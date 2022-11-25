const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'test.chotoni123',
        pass: 'pnchnwnqqogegcgl'
    }
});

var template = `
<div style="margin-left:20px; margin-right:20px;">
<div style="display: flex; align-items: center;">
    <h2>Alert: High Temperature</h2>
</div>
<div>
    <div style="background-color: #d7d9d7; padding: 5px 5px 20px 20px; border-radius: 10px;">
        <p>Temperature Cold Storage 1 reach high limit</p>
        <div style="margin: 2px; display: flex;">
            <span style="width: 4rem;">Value</span>:&nbsp;
            <span>-10</span>
            <span>&#8451;</span>
        </div>
        <div style="margin: 2px; display: flex;">
            <span style="width: 4rem;">Date</span>:&nbsp;
            <span>10 Januari 2023 09:00 WIB</span>
        </div>
        <div style="margin: 2px; display: flex;">
            <span style="width: 4rem;">Limit</span>:&nbsp;
            <span>-10</span>
            <span>&#8451;</span>
        </div>
    </div>
    <p style="font-size:14px;">Unfortunately, this email is an automated notification, which is unable to receive replies.</p>
</div>
</div>`

exports.send = async function( message ) {
    try {
        const result = await transporter.sendMail({
            from: 'test.chotoni123',
            to: 'rifqi.arti.rt@gmail.com',
            subject: message.subject,
            text: message.text,
            html: template
        });
        return result
    } catch (ex) {
        return ex
    }
};