/* See also:
 http://www.html5rocks.com/en/tutorials/webrtc/basics/
 https://code.google.com/p/webrtc-samples/source/browse/trunk/apprtc/index.html

 https://webrtc-demos.appspot.com/html/pc1.html
 */

var cfg = {'iceServers': [{'url': 'stun:23.21.150.121'}]},
    con = {'optional': [{'DtlsSrtpKeyAgreement': true}]};

/* THIS IS ALICE, THE CALLER/SENDER */
var isSession = false;
var pc1 = new RTCPeerConnection(cfg, con),
    dc1 = null, tn1 = null;

// Since the same JS file contains code for both sides of the connection,
// activedc tracks which of the two possible datachannel variables we're using.
var activedc;

var pc1icedone = false;

function getMyId() {
    var myUsername = localStorage.getItem("username");
    var myPrivateKey = localStorage.getItem("privateKey");
    var mypublicKey = localStorage.getItem("publicKey");


    if (myUsername != null && myPrivateKey != null && mypublicKey != null) {
        var retval = new Object();
        retval.username = myUsername;
        retval.publicKey = mypublicKey;
        retval.encryptedPrivateKey = myPrivateKey;
        return retval;
    } else {
        return null;
    }
}

console.log("Get from DB");
var myId = getMyId();

$("#joinBtn").prop('disabled', true);
$("#createBtn").prop('disabled', true);


if (myId != null) {
    document.getElementById("username").value = myId.username;
}

$("#newId").click(function () {
    username = document.getElementById("username").value;

    var passphrase = document.getElementById("passphrase").value;

    if (myId == null) {
        localStorage.setItem("username", username);
        // no id
        createKeyPair(passphrase);
    } else {
        // id found
        publicKey = myId.publicKey;
        decryptPrivateKey(myId.encryptedPrivateKey, passphrase);
    }

    $("#idForm").remove();
    $("#joinBtn").prop('disabled', false);
    $("#createBtn").prop('disabled', false);
});


$("#deleteId").click(function () {
    document.getElementById("username").value = "";
    document.getElementById("passphrase").value = "";

    localStorage.removeItem("username");
    localStorage.removeItem("privateKey");
    localStorage.removeItem("publicKey");
    localStorage.removeItem("salt");
    localStorage.removeItem("keyIV");

    alert("Done.")
});


$('#showLocalOffer').modal('hide');
$('#getRemoteAnswer').modal('hide');
$('#waitForConnection').modal('hide');
$('#createOrJoin').modal('show');

$('#createBtn').click(function () {
    $('#showLocalOffer').modal('show');
    createLocalOffer()
    isSession = true;
});

$('#joinBtn').click(function () {
    $('#getRemoteOffer').modal('show')
    isSession = true;
});

$('#offerSentBtn').click(function () {
    $('#getRemoteAnswer').modal('show')
});

$('#offerRecdBtn').click(function () {
    var offer = $('#remoteOffer').val();
    var offerDesc = new RTCSessionDescription(JSON.parse(offer))
    // console.log('Received remote offer', offerDesc);
    writeToChatLog('Received remote offer', 'text-success');
    handleOfferFromPC1(offerDesc);
    $('#showLocalAnswer').modal('show')
});

$('#answerSentBtn').click(function () {
    $('#waitForConnection').modal('show')
});

$('#answerRecdBtn').click(function () {
    var answer = $('#remoteAnswer').val();
    var answerDesc = new RTCSessionDescription(JSON.parse(answer))
    handleAnswerFromPC2(answerDesc);
    $('#waitForConnection').modal('show')
});


function handleMessage(message) {
    if (typeof message === "string")
        message = JSON.parse(message);

    if (message.type == "publickey1") {
        theirpPublicKey = message.value;
        theirUsername = message.username;

        //console.log(theirpPublicKey)
        //SEND OUR OWN PUBLIC KEY
        var channel = new RTCMultiSession()
        channel.send({message: {"type": "publickey2", "value": publicKey, "username": username}})

    } else if (message.type == "publickey2") {
        theirpPublicKey = message.value;
        theirUsername = message.username;
        //   console.log(theirpPublicKey)
    }
    else if (message.type == "data") {
        // writeToChatLog(message.value, 'text-info')
        // Scroll chat text area to the bottom on new input.
        decrypt(message.value);
        $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight)
    } else if (message.type == "status" && message.value == "left") {
        alert("They left the conversation");
    }
}

function sendMessage() {
    if ($('#messageTextBox').val()) {
        writeToChatLog($('#messageTextBox').val(), 'text-success')
        encrypt($('#messageTextBox').val())
        $('#messageTextBox').val('')
        // Scroll chat text area to the bottom on new input.
        $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight)
    }
    return false
}


function setupDC1() {
    try {
        var fileReceiver1 = new FileReceiver();
        dc1 = pc1.createDataChannel('test', {reliable: true})
        activedc = dc1
        //   console.log('Created datachannel (pc1)');
        dc1.onopen = function (e) {
            //   console.log('data channel connect');
            $('#waitForConnection').modal('hide');
            //$('body').removeClass('modal-open');
            //$('#waitForConnection').remove();


            var channel = new RTCMultiSession();
            channel.send({message: JSON.stringify({"type": "publickey1", "value": publicKey, "username": username})})
        };
        dc1.onmessage = function (e) {
            //   console.log('Got message (pc1)', e.data);
            if (e.data.size) {
                fileReceiver1.receive(e.data, {})
            } else {
                if (e.data.charCodeAt(0) == 2) {
                    // The first message we get from Firefox (but not Chrome)
                    // is literal ASCII 2 and I don't understand why -- if we
                    // leave it in, JSON.parse() will barf.
                    return
                }

                var data = JSON.parse(e.data);
                handleMessage(data.message)
            }
        }
    } catch (e) {
        console.warn('No data channel (pc1)', e);
    }
}

function createLocalOffer() {
    setupDC1();
    pc1.createOffer(function (desc) {
        pc1.setLocalDescription(desc, function () {
        }, function () {
        });
        //console.log('created local offer', desc)
    }, function () {
        console.warn("Couldn't create offer");
    })
}

pc1.onicecandidate = function (e) {
    // console.log('ICE candidate (pc1)', e)
    if (e.candidate == null) {
        $('#localOffer').html(JSON.stringify(pc1.localDescription))
    }
}

function handleOnconnection() {
    // console.log('Datachannel connected')
    writeToChatLog('Datachannel connected', 'text-success');
    $('#waitForConnection').modal('hide');
    //   $('body').removeClass('modal-open');
    //   $('#waitForConnection').remove();

    $('#showLocalAnswer').modal('hide');
    $('#messageTextBox').focus()
}

pc1.onconnection = handleOnconnection;

function onsignalingstatechange(state) {
    // console.info('signaling state change:', state)
}

function oniceconnectionstatechange(state) {
    //  console.info('ice connection state change:', state)
}

function onicegatheringstatechange(state) {
    //   console.info('ice gathering state change:', state)
}

pc1.onsignalingstatechange = onsignalingstatechange;
pc1.oniceconnectionstatechange = oniceconnectionstatechange;
pc1.onicegatheringstatechange = onicegatheringstatechange;

function handleAnswerFromPC2(answerDesc) {
    // console.log('Received remote answer: ', answerDesc)
    writeToChatLog('Received remote answer', 'text-success');
    pc1.setRemoteDescription(answerDesc)
}

function handleCandidateFromPC2(iceCandidate) {
    pc1.addIceCandidate(iceCandidate)
}

/* THIS IS BOB, THE ANSWERER/RECEIVER */

var pc2 = new RTCPeerConnection(cfg, con),
    dc2 = null

var pc2icedone = false

pc2.ondatachannel = function (e) {
    var fileReceiver2 = new FileReceiver();
    var datachannel = e.channel || e; // Chrome sends event, FF sends raw channel
    // console.log('Received datachannel (pc2)', arguments)
    dc2 = datachannel
    activedc = dc2
    dc2.onopen = function (e) {
        //  console.log('data channel connect')
        $('#waitForConnection').modal('hide');
        //  $('body').removeClass('modal-open');
        $('#waitForConnection').remove();
    }
    dc2.onmessage = function (e) {
        //   console.log('Got message (pc2)', e.data)
        if (e.data.size) {
            fileReceiver2.receive(e.data, {})
        } else {
            var data = JSON.parse(e.data);
            handleMessage(data.message)
        }
    }
};

function handleOfferFromPC1(offerDesc) {
    pc2.setRemoteDescription(offerDesc);
    pc2.createAnswer(function (answerDesc) {
        writeToChatLog('Created local answer', 'text-success');
        // console.log('Created local answer: ', answerDesc)
        pc2.setLocalDescription(answerDesc)
    }, function () {
        console.warn('No create answer');
    })
}

pc2.onicecandidate = function (e) {
    //  console.log('ICE candidate (pc2)', e)
    if (e.candidate == null)
        $('#localAnswer').html(JSON.stringify(pc2.localDescription))
}

pc2.onsignalingstatechange = onsignalingstatechange;
pc2.oniceconnectionstatechange = oniceconnectionstatechange;
pc2.onicegatheringstatechange = onicegatheringstatechange;

function handleCandidateFromPC1(iceCandidate) {
    pc2.addIceCandidate(iceCandidate)
}

pc2.onaddstream = function (e) {
    //console.log('Got remote stream', e)
    var el = new Audio();
    el.autoplay = true;
    attachMediaStream(el, e.stream)
};

pc2.onconnection = handleOnconnection;

function getTimestamp() {
    var totalSec = new Date().getTime() / 1000;
    var hours = parseInt(totalSec / 3600) % 24;
    var minutes = parseInt(totalSec / 60) % 60;
    var seconds = parseInt(totalSec % 60);

    var result = (hours < 10 ? '0' + hours : hours) + ':' +
        (minutes < 10 ? '0' + minutes : minutes) + ':' +
        (seconds < 10 ? '0' + seconds : seconds);

    return result
}

function writeToChatLog(message, message_type) {
    document.getElementById('chatlog').innerHTML += '<p class="' + message_type + '">' + '[' + getTimestamp() + '] ' + message + '</p>';
}

$(window).bind('beforeunload', function () {
    if (isSession) {
        return 'If you leave this page, your session will be lost.';
    }
});

window.onunload = function () {
    var channel = new RTCMultiSession()
    channel.send({message: {"type": "status", "value": "left"}});

    //$("#messageTextBox").prop('disabled', true);
}