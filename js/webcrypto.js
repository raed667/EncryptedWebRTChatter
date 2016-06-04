document.addEventListener("DOMContentLoaded", function () {
    "use strict";
    if (!window.crypto || !window.crypto.subtle) {
        alert("Your current browser does not support the Web Cryptography API! This page will not work.");
        return;
    }
});

var myKeys;
var username;
var publicKey;
var privateKey;
var theirpPublicKey;
var theirUsername;
var encryptedSessionKey;
var message;

function convertPassphraseToKey(passphraseString, saltBase64) {
    // Loading
    console.log("Generating key...");

    var iterations = 1000000;   // Longer is slower... hence stronger
    var saltBytes = base64ToByteArray(saltBase64); //
    var passphraseBytes = stringToByteArray(passphraseString);

    // deriveKey needs to be given a base key. This is just a
    // CryptoKey that represents the starting passphrase.
    return window.crypto.subtle.importKey(
        "raw", passphraseBytes, {name: "PBKDF2"}, false, ["deriveKey"]
    ).then(function (baseKey) {
        return window.crypto.subtle.deriveKey(
            // Firefox currently only supports SHA-1 with PBKDF2
            {name: "PBKDF2", salt: saltBytes, iterations: iterations, hash: "SHA-1"},
            baseKey,
            {name: "AES-CBC", length: 256}, // Resulting key type we want
            true,  // exportable
            ["encrypt", "decrypt"]
        );
    }).catch(function (err) {
        alert("Could not generate a key from passphrase '" + passphrase + "': " + err.message);
    });
}

function decryptPrivateKey(encryptedPrivaeKey, passphrase) {
    var base64Salt = localStorage.getItem("salt");
    var salt = base64ToByteArray(base64Salt);


    console.debug("Cipher[1] :" + encryptedPrivaeKey);


    convertPassphraseToKey(passphrase, base64Salt).then(function (key) {

        console.log('Decrypting private key...');
        // console.debug(aesKey);
        var ciphertextBytes = base64ToByteArray(encryptedPrivaeKey);

        /// CALL AES CBC ENCRYPT
        var ivBase64 = (localStorage.getItem("keyIV"));
        var iv = base64ToByteArray(ivBase64);

        window.crypto.subtle.encrypt(
            {name: "AES-CBC", iv: iv},
            key,
            ciphertextBytes
        ).then(function (plaintextBuf) {
            // Encode ciphertext to base 64 and put in Ciphertext field
            plaintextBytes = new Uint8Array(plaintextBuf);
            base64plaintext = byteArrayToBase64(plaintextBytes);

            /// SET GLOBAL VARIABLE AS PRIVATE KEY
            privateKey = base64plaintext;

            console.debug("Clear [1] :" + privateKey);

            console.log("Done: Decrypting of private key")

        }).catch(function (err) {
            alert("Decryption error: " + err.message);
        });
    });
}


function encryptPrivateKey(privateKey, passphrase) {

    console.debug("Clear[0] :" + privateKey);

    var salt = window.crypto.getRandomValues(new Uint8Array(16));
    var base64Salt = byteArrayToBase64(salt);

    localStorage.setItem("salt", base64Salt);

    convertPassphraseToKey(passphrase, base64Salt).then(function (key) {

        console.log('Encrypting private key...');
        // console.debug(aesKey);
        var plaintextBytes = base64ToByteArray(privateKey);

        /// CALL AES CBC ENCRYPT
        var iv = window.crypto.getRandomValues(new Uint8Array(16));
        var ivBase64 = byteArrayToBase64(iv);
        localStorage.setItem("keyIV", ivBase64);

        window.crypto.subtle.encrypt(
            {name: "AES-CBC", iv: iv},
            key,
            plaintextBytes
        ).then(function (ciphertextBuf) {
            // Encode ciphertext to base 64 and put in Ciphertext field
            ciphertextBytes = new Uint8Array(ciphertextBuf);
            base64Ciphertext = byteArrayToBase64(ciphertextBytes);
            localStorage.setItem("privateKey", base64Ciphertext);

            console.debug("Cipher[0] :" + base64Ciphertext);

            console.log("Done: Encrypting of private key")

        }).catch(function (err) {
            alert("Encryption error: " + err.message);
        });
    });
}


function createKeyPair(passphrase) {
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
            localStorage.setItem("publicKey", publicKey);
        }).catch(function (err) {
            alert("Could not export public key: " + err.message);
        });

        window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey
        ).then(function (pkcs8Buffer) {
            var pkcs8Bytes = new Uint8Array(pkcs8Buffer);
            var pkcs8String = byteArrayToBase64(pkcs8Bytes);
            privateKey = pkcs8String;

            encryptPrivateKey(privateKey, passphrase)

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

    console.log("decrypt");
    console.debug(privateKey);

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
                    writeToChatLog(theirUsername + ": " + plaintextDecypted, 'text-info')

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