const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')

async function connectionLogic() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const sock = makeWASocket({
        // can provide additional config here
        printQRInTerminal: true,
        auth: state
    });
    
    sock.ev.on("connection.update", async(update)=>{
        const {connection, lastDisconnect, qr} = update;
        
        if(qr){
            console.log(qr);
        }
        
        if(connection === "close"){
            const shouldReconnect =
            lastDisconnect?.error?.output?.statusCode !==
            DisconnectReason.loggedOut;
            
            if (shouldReconnect) {
                connectionLogic();
            }
        }
    });

    sock.ev.on ('creds.update', saveCreds)
}

connectionLogic();