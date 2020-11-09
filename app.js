(function () {
  let dataConnection = null;
  let mediaConnection = null;

  const peersEl = document.querySelector('.peers');
  const listPeersButtonEl = document.querySelector('.list-all-peers-button');
  const sendButtonEl = document.querySelector('.send-new-message-button');
  const newMessageEl = document.querySelector('.new-message');
  const messagesEl = document.querySelector('.messages');
  const theirVideoContainer = document.querySelector('.video-container.them');
  const startVideoButton = theirVideoContainer.querySelector('.start');
  const stopVideoButton = theirVideoContainer.querySelector('.stop');
  const videoOfThemEl = document.querySelector('.video-container.them video');
  const videoOfMeEl = document.querySelector('.video-container.me video');

  // Display video of me.
  navigator.mediaDevices
    .getUserMedia({ audio: false, video: true })
    .then((stream) => {
      videoOfMeEl.muted = true;
      videoOfMeEl.srcObject = stream;
    });

  const printMessage = (text, who) => {
    const currentTime = new Date();
    const timeStamp = currentTime.toLocaleString();
    const messageEl = document.createElement('div');
    messageEl.classList.add('message', who);
    messageEl.innerHTML = `<div>${text}<br><small> // ${timeStamp}</small></div>`;
    messagesEl.append(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    console.log(timeStamp);
  };

  // Get peer id (hash) from URL.
  const myPeerId = location.hash.slice(1);

  // Connect to Peer server.
  let peer = new Peer(myPeerId, {
    host: 'glajan.com',
    port: 8443,
    path: '/myapp',
    secure: true,
    config: {
      iceServers: [
        { urls: ['stun:eu-turn7.xirsys.com'] },
        {
          username:
            '1FOoA8xKVaXLjpEXov-qcWt37kFZol89r0FA_7Uu_bX89psvi8IjK3tmEPAHf8EeAAAAAF9NXWZnbGFqYW4=',
          credential: '83d7389e-ebc8-11ea-a8ee-0242ac140004',
          urls: [
            'turn:eu-turn7.xirsys.com:80?transport=udp',
            'turn:eu-turn7.xirsys.com:3478?transport=udp',
            'turn:eu-turn7.xirsys.com:80?transport=tcp',
            'turn:eu-turn7.xirsys.com:3478?transport=tcp',
            'turns:eu-turn7.xirsys.com:443?transport=tcp',
            'turns:eu-turn7.xirsys.com:5349?transport=tcp',
          ],
        },
      ],
    },
  });

  // Print peer id on connection 'open' event.
  peer.on('open', (id) => {
    const myPeerIdEl = document.querySelector('.my-peer-id');
    myPeerIdEl.innerText = id;
  });
  peer.on('error', (errorMessage) => {
    console.error(errorMessage);
  });

  // On incoming connection.
  peer.on('connection', (connection) => {
    // Close existing connection & Set new connection
    dataConnection && dataConnection.close();
    dataConnection = connection;

    const event = new CustomEvent('peer-changed', { detail: connection.peer });
    document.dispatchEvent(event);
  });

  // Event listener for incoming video call.
  peer.on('call', (incomingCall) => {
    mediaConnection && mediaConnection.close();

    // Change state on start/stop button
    startVideoButton.classList.remove('active');
    stopVideoButton.classList.add('active');

    // Answer incoming call.
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: true })
      .then((myStream) => {
        incomingCall.answer(myStream);
        mediaConnection = incomingCall;
        mediaConnection.on('stream', (theirStream) => {
          videoOfThemEl.muted = true;
          videoOfThemEl.srcObject = theirStream;
        });
      });
  });

  // Event listener for click "Refresh list".
  listPeersButtonEl.addEventListener('click', () => {
    peer.listAllPeers((peers) => {
      let str = '<ul>';
      const listItems = peers
        .filter((peerId) => peerId !== peer._id)
        .forEach((listItems) => {
          str +=
            `<li><button class="connect-button peerId-${listItems}">` +
            listItems +
            '</button></li>';
        });
      str += '</ul>';
      peersEl.innerHTML = str;
    });
  });

  // Event listener for click peer button
  peersEl.addEventListener('click', (e) => {
    if (!e.target.classList.contains('connect-button')) return;
    const theirPeerId = e.target.innerText;

    // Close existing connection
    dataConnection && dataConnection.close();

    // Connect to peer
    dataConnection = peer.connect(theirPeerId);
    dataConnection.on('open', () => {
      // Dispatch event with peer id.
      const event = new CustomEvent('peer-changed', { detail: theirPeerId });
      document.dispatchEvent(event);
    });
  });

  // Get clicked button. Listen for Custom Event "peer-changed"
  document.addEventListener('peer-changed', (e) => {
    const peerId = e.detail;
    console.log('Connected to: ' + e.detail);
    const connectButtonEl = document.querySelector(
      `.connect-button.peerId-${peerId}`
    );

    // Remove class 'connected' from button.
    document.querySelectorAll('.connect-button.connected').forEach((button) => {
      button.classList.remove('connected');
    });

    // Add class 'connected' to clicked button
    connectButtonEl && connectButtonEl.classList.add('connected');

    // Listen for incoming data/textmessage.
    dataConnection.on('data', (textMessage) => {
      printMessage(textMessage, 'them');
    });

    // Set focus on text input field after connection
    newMessageEl.focus();

    theirVideoContainer.querySelector('.name').innerText = peerId;
    theirVideoContainer.classList.add('connected');
    theirVideoContainer.querySelector('.start').classList.add('active');
    theirVideoContainer.querySelector('.stop').classList.remove('active');
  });

  // Send message to peer.
  const sendMessage = (e) => {
    if (!dataConnection) return;
    if (newMessageEl.value === '') return;

    if (e.type === 'click' || e.keyCode === 13) {
      dataConnection.send(newMessageEl.value);
      printMessage(newMessageEl.value, 'me');
      // Clear text input field.
      newMessageEl.value = '';
    }
    // Set focus on text input field after send message
    newMessageEl.focus();
  };

  // Event listener for 'send'.
  sendButtonEl.addEventListener('click', sendMessage);
  newMessageEl.addEventListener('keyup', sendMessage);

  // Event listener for click 'start video chat'.

  startVideoButton.addEventListener('click', () => {
    startVideoButton.classList.remove('active');
    stopVideoButton.classList.add('active');

    // Start video with remote peer.
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: true })
      .then((myStream) => {
        mediaConnection && mediaConnection.close();
        const theirPeerId = dataConnection.peer;
        mediaConnection = peer.call(theirPeerId, myStream);
        mediaConnection.on('stream', (theirStream) => {
          videoOfThemEl.muted = true;
          videoOfThemEl.srcObject = theirStream;
        });
      });
  });

  // Event listener for click 'Hang up'.
  stopVideoButton.addEventListener('click', () => {
    stopVideoButton.classList.remove('active');
    startVideoButton.classList.add('active');
    mediaConnection && mediaConnection.close();
  });
})();
