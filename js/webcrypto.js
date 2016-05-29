document.addEventListener("DOMContentLoaded", function () {
    "use strict";
    if (!window.crypto || !window.crypto.subtle) {
        alert("Your current browser does not support the Web Cryptography API! This page will not work.");
        return;
    }
});

var myKeys;
var publicKey;
var privateKey;
var theirpPublicKey;
var encryptedSessionKey;
var message;
function createKeyPair() {
    window.crypto.subtle.generateKey(
        {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]), // 65537
            hash: {name: "SHA-256"}
        },
        true,
        ["sign", "verify"]
    ).then(function (keyPair) {
        myKeys = keyPair;
        window.crypto.subtle.exportKey("spki", keyPair.publicKey
        ).then(function (spkiBuffer) {
            var spkiBytes = new Uint8Array(spkiBuffer);
            var spkiString = byteArrayToBase64(spkiBytes);
            publicKey = spkiString;
        }).catch(function (err) {
            alert("Could not export public key: " + err.message);
        });

        window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey
        ).then(function (pkcs8Buffer) {
            var pkcs8Bytes = new Uint8Array(pkcs8Buffer);
            var pkcs8String = byteArrayToBase64(pkcs8Bytes);
            privateKey = pkcs8String;
        }).catch(function (err) {
            alert("Could not export private key: " + err.message);
        });

    }).catch(function (err) {
        alert("Could not generate key pair: " + err.message);
    });
}

function encrypt(inputPlaintext) {

    var spkiBytes = base64ToByteArray(theirpPublicKey);
    // Start by getting the RSA public key for encrypting session key
    window.crypto.subtle.importKey(
        "spki",
        spkiBytes,
        {name: "RSA-OAEP", hash: "SHA-256"},
        false,
        ["encrypt"]
    ).then(function (publicKey) {
        // Now we need to create a random session key for encrypting
        // the actual plaintext.
        return window.crypto.subtle.generateKey(
            {name: "AES-CBC", length: 256},
            true,
            ["encrypt", "decrypt"]
        ).then(function (sessionKey) {
            // We need to do two things with the session key:
            //    Use it to encrypt the selected plaintext file
            //    Encrypt the session key with the public key

            // Part 1 - Read the file and encrypt it with the session key.
            var input = inputPlaintext; //document.getElementById("plaintext").value;
            // console.debug(inputPlaintext);
            encryptReadFile(input); // See definition below

            function encryptReadFile(inputPlaintext) {
                var ivBytes = window.crypto.getRandomValues(new Uint8Array(16));
                var plaintextBytes = new TextEncoder("utf-8").encode(inputPlaintext);
                window.crypto.subtle.encrypt(
                    {name: "AES-CBC", iv: ivBytes}, sessionKey, plaintextBytes
                ).then(function (ciphertextBuffer) {
                    // Build a Blob with the 16-byte IV followed by the ciphertext
                    var toBeSent = [ivBytes, new Uint8Array(ciphertextBuffer)];
                    message = {"iv": byteArrayToBase64(toBeSent[0]), "ciphertext": byteArrayToBase64(toBeSent[1])};
                }).catch(function (err) {
                    alert("Could not encrypt the plaintext: " + err.message);
                });
            }

            // Part 2 - encrypt the session key with the public key. This
            //          requires exporting it first.
            window.crypto.subtle.exportKey(
                "raw", sessionKey
            ).then(function (sessionKeyBuffer) {
                // Encrypt the session key in the buffer, save the encrypted
                // key in the keyBox element.
                window.crypto.subtle.encrypt(
                    {name: "RSA-OAEP"},
                    publicKey, // from closure
                    sessionKeyBuffer
                ).then(function (encryptedSessionKeyBuffer) {
                    var encryptedSessionKeyBytes = new Uint8Array(encryptedSessionKeyBuffer);
                    var encryptedSessionKeyBase64 = byteArrayToBase64(encryptedSessionKeyBytes);
                    encryptedSessionKey = encryptedSessionKeyBase64;
                    message.sessionkey = encryptedSessionKey;
                    var channel = new RTCMultiSession();
                    channel.send({message: {"type": "data", "value": JSON.stringify(message)}})
                }).catch(function (err) {
                    alert("Could not encrypt session key.");
                });
            }).catch(function (err) {
                alert("Could not export random session key:" + err.message);
            });
        }).catch(function (err) {
            alert("Could not generate random session key: " + err.message);
        });
    }).catch(function (err) {
        alert("Could not import public key: " + err.message);
    });
}

function decrypt(message) {
    var pkcs8Bytes = base64ToByteArray(privateKey);

    // We need a CryptoKey object holding the private key to get started
    window.crypto.subtle.importKey(
        "pkcs8",
        pkcs8Bytes,
        {name: "RSA-OAEP", hash: "SHA-256"},
        false,
        ["decrypt"]
    ).then(function (privateKey) {

        // Now use the private key to decrypt the session key
        //var keyBox = document.getElementById("sessionkey");
        message = JSON.parse(message);

        // console.debug(message)

        var encryptedSessionKeyBase64 = message.sessionkey;  //keyBox.value;
        var encryptedSessionKeyBytes = base64ToByteArray(encryptedSessionKeyBase64);

        window.crypto.subtle.decrypt(
            {name: "RSA-OAEP"}, privateKey, encryptedSessionKeyBytes
        ).then(function (sessionKeyBuffer) {

            window.crypto.subtle.importKey(
                // We can't use the session key until it is in a CryptoKey object
                "raw", sessionKeyBuffer, {name: "AES-CBC", length: 256}, false, ["decrypt"]
            ).then(function (sessionKey) {
                // Finally, we can read and decrypt the ciphertext file
                var ciphertextBytes = base64ToByteArray(message.ciphertext);
                var ivBytes = base64ToByteArray(message.iv);
                window.crypto.subtle.decrypt(
                    {name: "AES-CBC", iv: ivBytes}, sessionKey, ciphertextBytes
                ).then(function (plaintextBuffer) {

                    var plaintextDecypted = String.fromCharCode.apply(null, new Uint8Array(plaintextBuffer));
                    writeToChatLog(plaintextDecypted, 'text-info')

                }).catch(function (err) {
                    alert("Could not decrypt the ciphertext: " + err.message);
                });
            }).catch(function (err) {
                alert("Error importing session key: " + err.message);
            });
        }).catch(function (err) {
            alert("Error decrypting session key: " + err.message);
        });
    }).catch(function (err) {
        alert("Could not import private key: " + err.message)
    });
}