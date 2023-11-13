const express = require('express');
const path = require('path'); // Add the path module
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, DisconnectReason, makeInMemoryStore,
    fetchLatestBaileysVersion 
} 
= require('@whiskeysockets/baileys')

const log = (pino = require("pino"));
const { session } = {"session": "baileys_auth_info"};
const { Boom } =require("@hapi/boom");


const fs = require('fs');
const { Console } = require('console');

const folderPath = './auth_info_baileys';
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require("body-parser");

const app = express();
app.use(express.json());
app.use(fileUpload({
    createParentPath: true
}));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });
let sock;
async function connectionLogic() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    let { version, isLatest } = await fetchLatestBaileysVersion();
    sock = makeWASocket({
        // can provide additional config here
        syncFullHistory: true,
        printQRInTerminal: true,
        auth: state,
        logger: log({ level: "silent" }),
        version,
    });
    store.bind(sock.ev);
    sock.multi = true
    sock.ev.on('connection.update', async (update) => {
        //console.log(update);
        const { connection, lastDisconnect } = update;
        if(connection === 'close') {
            let reason = new Boom(lastDisconnect.error).output.statusCode;
            if (reason === DisconnectReason.badSession) {
                console.log(`Bad Session File, Please Delete ${session} and Scan Again`);
                sock.logout();
            } else if (reason === DisconnectReason.connectionClosed) {
                console.log("Connection closed, reconnecting....");
                connectionLogic();
            } else if (reason === DisconnectReason.connectionLost) {
                console.log("Connection Lost from Server, reconnecting...");
                connectionLogic();
            } else if (reason === DisconnectReason.connectionReplaced) {
                console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First");
                sock.logout();
            } else if (reason === DisconnectReason.loggedOut) {
                console.log(`Device Logged Out, Please Delete ${session} and Scan Again.`);
                fs.rmdir(folderPath, { recursive: true }, (err) => {
                    if (err) {
                        console.error(`Error deleting folder: ${err.message}`);
                    } else {
                        console.log(`Folder deleted successfully: ${folderPath}`);
                    }
                });
                connectionLogic();
            } else if (reason === DisconnectReason.restartRequired) {
                console.log("Restart Required, Restarting...");
                connectionLogic();
            } else if (reason === DisconnectReason.timedOut) {
                console.log("Connection TimedOut, Reconnecting...");
                connectionLogic();
            } else {
                sock.end(`Unknown DisconnectReason: ${reason}|${lastDisconnect.error}`);
            }
        }else if(connection === 'open') {
            console.log('opened connection');
            let getGroups = await sock.groupFetchAllParticipating();
            let groups = Object.entries(getGroups).slice(0).map(entry => entry[1]);
            console.log(groups);
            return sock;
        } 
    });
    
    sock.ev.on ('creds.update', saveCreds)
    
    
    
    
    
    
    
    
    
}

const isConnected = () => {
    return (sock.user);
}


app.post("/kirim", async (req, res) => {
    try {
        const pesan = req.body.message;
        const number = req.body.number;
        let numberWA;

        if (!req.files) {
            console.log(req.body);
            if (!number) {

                return res.status(500).json({
                    status: false,
                    response: 'Nomor Belum diisi !!!'
                });
            } else {
                numberWA = '62' + number.substring(1) + "@s.whatsapp.net";
                console.log(`Nomor WhatsApp: ${numberWA}`);
                console.log(req.body);
                if (isConnected) {
                    const exists = await sock.onWhatsApp(numberWA);

                    if (exists?.jid || (exists && exists[0]?.jid)) {
                        await sock.sendMessage(exists.Jid || exists[0].jid, { text: pesan });
                        return res.status(200).json({
                            status: true,
                            response: "Pesan berhasil dikirim.",
                        });
                    } else {
                        return res.status(500).json({
                            status: false,
                            response: `Nomor ${number} tidak terdaftar.`,
                        });
                    }
                } else {
                    return res.status(500).json({
                        status: false,
                        response: 'WhatsApp belum terhubung',
                    });
                }
            }
        } else {
            if (!number) {
                return res.status(500).json({
                    status: false,
                    response: 'Nomor WA belum diisi !!!'
                });
            } else {
                numberWA = '62' + number.substring(1) + "@s.whatsapp.net";
                let filesimpan = req.files.file;
                var file_ubah_nama = new Date().getTime() + '_' + filesimpan.name;

                // Correct the path to the 'upload' folder
                filesimpan.mv('./uploads/' + file_ubah_nama);

                let fileDikirim_mime = filesimpan.mimetype;
                let pesankirim = req.body.pesan; // Add pesankirim

                if (isConnected) {
                    const exists = await sock.onWhatsApp(numberWA);

                    if (exists?.jid || (exists && exists[0]?.jid)) {
                        let namafiledikirim = './uploads/' + file_ubah_nama;
                        let extensionName = path.extname(namafiledikirim);

                        if (extensionName === '.jpeg' || extensionName === '.jpg' || extensionName === '.png' || extensionName === '.gif') {
                            // Use `await` for the file deletion process
                            await sock.sendMessage(exists.jid || exists[0].jid, {
                                image: {
                                    url: namafiledikirim
                                },
                                caption: pesankirim
                            }).then(async (result) => {
                                // Use `await` for the file deletion process
                                await fs.promises.unlink(namafiledikirim);
                                res.send({
                                    status: true,
                                    message: 'Success',
                                    data: {
                                        name: filesimpan.name,
                                        mimetype: filesimpan.mimetype,
                                        size: filesimpan.size
                                    }
                                });
                            }).catch((err) => {
                                res.status(500).json({
                                    status: false,
                                    response: err,
                                });
                                console.log('pesan gagal terkirim');
                            });
                        } else if (extensionName === '.mp3' || extensionName === '.ogg') {
                            // Use `await` for the file deletion process
                            await sock.sendMessage(exists.jid || exists[0].jid, {
                                audio: {
                                    url: namafiledikirim,
                                    caption: pesankirim
                                },
                                mimetype: 'audio/mp4'
                            }).then(async (result) => {
                                // Use `await` for the file deletion process
                                await fs.promises.unlink(namafiledikirim);
                                res.send({
                                    status: true,
                                    messsage: 'Success',
                                    data: {
                                        name: filesimpan.name,
                                        mimetype: filesimpan.mimetype,
                                        size: filesimpan.size
                                    }
                                });
                            }).catch((err) => {
                                res.status(500).json({
                                    status: false,
                                    response: err,
                                });
                                console.log('pesan gagal terkirim');
                            });
                        } else {
                            // Use `await` for the file deletion process
                            await sock.sendMessage(exists.jid || exists[0].jid, {
                                document: {
                                    url: namafiledikirim,
                                    caption: pesankirim
                                },
                                mimetype: fileDikirim_mime,
                                fileName: filesimpan.name
                            }).then(async (result) => {
                                // Use `await` for the file deletion process
                                await fs.promises.unlink(namafiledikirim);
                                res.send({
                                    status: true,
                                    message: 'Success',
                                    data: {
                                        name: filesimpan.name,
                                        mimetype: filesimpan.mimetype,
                                        size: filesimpan.size
                                    }
                                });
                            }).catch((err) => {
                                res.status(500).json({
                                    status: false,
                                    response: err,
                                });
                                console.log('pesan gagal terkirim');
                            });
                        }
                    } else {
                        return res.status(500).json({
                            status: false,
                            response: `Nomor ${number} tidak terdaftar.`,
                        });
                    }
                } else {
                    return res.status(500).json({
                        status: false,
                        response: `WhatsApp belum terhubung.`,
                    });
                }
            }
        }
    } catch (err) {
        res.status(500).send(err);
    }
});



connectionLogic();
app.listen(8000, ()=>{
    console.log('server berhasil running di port 8000');
})