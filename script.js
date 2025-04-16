// DOM Elements
const connectBtn = document.getElementById("connect-btn")
const talkBtn = document.getElementById("talk-btn")
const statusEl = document.getElementById("status")
const channelDisplay = document.getElementById("channel-display")
const activeUserEl = document.getElementById("active-user")
const volumeControl = document.getElementById("volume")
const participantsList = document.getElementById("participants-list")
const usernameInput = document.getElementById("username")
const editUsernameBtn = document.getElementById("edit-username")
const roomIdInput = document.getElementById("room-id")
const joinRoomBtn = document.getElementById("join-room")

// Audio elements for radio sound effects
const startToneAudio = new Audio()
startToneAudio.src = "https://cdn.freesound.org/previews/459/459149_4768586-lq.mp3" // Radio start beep

const endToneAudio = new Audio()
endToneAudio.src = "https://cdn.freesound.org/previews/459/459148_4768586-lq.mp3" // Radio end beep

const staticAudio = new Audio()
staticAudio.src = "https://cdn.freesound.org/previews/234/234988_4568611-lq.mp3" // Radio static noise
staticAudio.loop = true

// Variables for WebRTC
let peer = null
let connections = {}
let localStream = null
let username = "Usuario"
let roomId = "corazones-abiertos"
let isConnected = false
let isTalking = false

// Set initial volume
volumeControl.addEventListener("input", () => {
  const volume = volumeControl.value
  startToneAudio.volume = volume
  endToneAudio.volume = volume
  staticAudio.volume = volume * 0.3 // Lower volume for static
})

// Username editing
editUsernameBtn.addEventListener("click", () => {
  const newUsername = usernameInput.value.trim()
  if (newUsername && newUsername !== username) {
    username = newUsername
    localStorage.setItem("walkie-talkie-username", username)

    // Update UI
    updateParticipantsList()

    // Notify other peers about name change
    if (isConnected) {
      broadcastMessage({
        type: "name-change",
        oldName: username,
        newName: newUsername,
      })
    }

    alert(`Nombre cambiado a: ${username}`)
  }
})

// Room joining
joinRoomBtn.addEventListener("click", () => {
  const newRoomId = roomIdInput.value.trim()
  if (newRoomId && newRoomId !== roomId) {
    // If already connected, disconnect first
    if (isConnected) {
      disconnectCall()
      isConnected = false
      connectBtn.textContent = "Conectar"
      statusEl.textContent = "Desconectado"
      statusEl.className = "status disconnected"
    }

    roomId = newRoomId
    localStorage.setItem("walkie-talkie-room", roomId)
    channelDisplay.textContent = `Canal: ${roomId}`

    alert(`Te has unido al canal: ${roomId}`)
  }
})

// Connect button event
connectBtn.addEventListener("click", async () => {
  if (!isConnected) {
    try {
      await setupConnection()
      isConnected = true
      connectBtn.textContent = "Desconectar"
      statusEl.textContent = "Conectado"
      statusEl.className = "status connected"
      talkBtn.disabled = false

      // Add self to participants list
      updateParticipantsList()
    } catch (error) {
      console.error("Error connecting:", error)
      statusEl.textContent = "Error al conectar"
      statusEl.className = "status disconnected"
    }
  } else {
    disconnectCall()
    isConnected = false
    connectBtn.textContent = "Conectar"
    statusEl.textContent = "Desconectado"
    statusEl.className = "status disconnected"
    talkBtn.disabled = true

    // Clear participants list
    participantsList.innerHTML = ""
    activeUserEl.textContent = ""
  }
})

// Talk button events
talkBtn.addEventListener("mousedown", startTalking)
talkBtn.addEventListener("touchstart", startTalking)
talkBtn.addEventListener("mouseup", stopTalking)
talkBtn.addEventListener("touchend", stopTalking)
talkBtn.addEventListener("mouseleave", stopTalking)

// Start talking function
function startTalking(e) {
  e.preventDefault()
  if (!isConnected || isTalking) return

  isTalking = true
  talkBtn.classList.add("active")

  // Play start tone (walkie-talkie beep)
  startToneAudio.currentTime = 0
  startToneAudio.play()

  // Play static sound in the background
  setTimeout(() => {
    if (isTalking) {
      staticAudio.currentTime = 0
      staticAudio.play()
    }
  }, 300) // Small delay after the beep

  // Broadcast that we're talking
  broadcastMessage({
    type: "talking-start",
    username: username,
  })

  // Start sending audio to all peers
  startAudioBroadcast()
}

// Stop talking function
function stopTalking(e) {
  if (e) e.preventDefault()
  if (!isTalking) return

  isTalking = false
  talkBtn.classList.remove("active")

  // Stop static sound
  staticAudio.pause()
  staticAudio.currentTime = 0

  // Play end tone (walkie-talkie end beep)
  endToneAudio.currentTime = 0
  endToneAudio.play()

  // Broadcast that we've stopped talking
  broadcastMessage({
    type: "talking-stop",
    username: username,
  })

  // Stop sending audio
  stopAudioBroadcast()
}

// Setup WebRTC connection
async function setupConnection() {
  statusEl.textContent = "Conectando..."
  statusEl.className = "status connecting"

  try {
    // Get user media (microphone)
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    })

    // Initialize PeerJS
    const peerId = `${roomId}-${generateRandomId()}`
    peer = new Peer(peerId)

    return new Promise((resolve, reject) => {
      peer.on("open", (id) => {
        console.log("My peer ID is: " + id)

        // Set up event listeners for peer connections
        setupPeerEventListeners()

        // Join the room
        joinRoom(roomId)

        resolve()
      })

      peer.on("error", (err) => {
        console.error("Peer connection error:", err)
        reject(err)
      })
    })
  } catch (error) {
    console.error("Error setting up media devices:", error)
    throw error
  }
}

// Set up peer event listeners
function setupPeerEventListeners() {
  // Handle incoming connections
  peer.on("connection", (conn) => {
    handleConnection(conn)
  })

  // Handle incoming calls
  peer.on("call", (call) => {
    // Answer the call with our local stream
    call.answer(localStream)

    // Handle the incoming audio stream
    call.on("stream", (remoteStream) => {
      // Create an audio element to play the remote stream
      const audio = new Audio()
      audio.srcObject = remoteStream
      audio.autoplay = true

      // Store the audio element with the connection
      if (connections[call.peer]) {
        connections[call.peer].audio = audio
      }
    })
  })
}

// Handle a new data connection
function handleConnection(conn) {
  // Store the connection
  connections[conn.peer] = {
    conn: conn,
    username: "Usuario",
    isTalking: false,
  }

  // Set up connection event listeners
  conn.on("open", () => {
    console.log("Connection established with peer:", conn.peer)

    // Send our username to the new peer
    conn.send({
      type: "username",
      username: username,
    })
  })

  conn.on("data", (data) => {
    handlePeerMessage(conn.peer, data)
  })

  conn.on("close", () => {
    console.log("Connection closed with peer:", conn.peer)
    delete connections[conn.peer]
    updateParticipantsList()
  })
}

// Join a room
function joinRoom(roomId) {
  // In a real app, you would use a signaling server to discover peers in the room
  // For this demo, we'll use a simple approach with PeerJS's random IDs

  // Connect to any existing peers in the room
  // This would normally be handled by a signaling server
  // For demo purposes, we'll just update the UI
  updateParticipantsList()
}

// Start broadcasting audio to all peers
function startAudioBroadcast() {
  Object.keys(connections).forEach((peerId) => {
    // Call the peer if we haven't already
    if (!connections[peerId].call) {
      const call = peer.call(peerId, localStream)
      connections[peerId].call = call
    }
  })
}

// Stop broadcasting audio
function stopAudioBroadcast() {
  // In a real implementation, you would stop the tracks or mute the audio
  // For this demo, we'll just update the UI
}

// Broadcast a message to all connected peers
function broadcastMessage(message) {
  Object.keys(connections).forEach((peerId) => {
    const connection = connections[peerId].conn
    if (connection && connection.open) {
      connection.send(message)
    }
  })
}

// Handle messages from peers
function handlePeerMessage(peerId, data) {
  if (!connections[peerId]) return

  switch (data.type) {
    case "username":
      connections[peerId].username = data.username
      updateParticipantsList()
      break

    case "talking-start":
      connections[peerId].isTalking = true
      activeUserEl.textContent = `${data.username} está hablando...`
      updateParticipantsList()

      // Play start tone
      startToneAudio.currentTime = 0
      startToneAudio.play()

      // Play static
      setTimeout(() => {
        staticAudio.currentTime = 0
        staticAudio.play()
      }, 300)
      break

    case "talking-stop":
      connections[peerId].isTalking = false
      activeUserEl.textContent = ""
      updateParticipantsList()

      // Stop static
      staticAudio.pause()
      staticAudio.currentTime = 0

      // Play end tone
      endToneAudio.currentTime = 0
      endToneAudio.play()
      break

    case "name-change":
      connections[peerId].username = data.newName
      updateParticipantsList()
      break
  }
}

// Update the participants list in the UI
function updateParticipantsList() {
  participantsList.innerHTML = ""

  // Add self
  const selfLi = document.createElement("li")
  selfLi.textContent = `${username} (Tú)`
  if (isTalking) {
    selfLi.classList.add("talking")
  }
  participantsList.appendChild(selfLi)

  // Add connected peers
  Object.keys(connections).forEach((peerId) => {
    const peer = connections[peerId]
    const li = document.createElement("li")
    li.textContent = peer.username
    if (peer.isTalking) {
      li.classList.add("talking")
    }
    participantsList.appendChild(li)
  })
}

// Disconnect call
function disconnectCall() {
  // Close all peer connections
  if (peer) {
    peer.destroy()
    peer = null
  }

  // Close all connections
  Object.keys(connections).forEach((peerId) => {
    const connection = connections[peerId].conn
    if (connection && connection.open) {
      connection.close()
    }
  })
  connections = {}

  // Stop local stream
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop())
    localStream = null
  }

  // Make sure all audio is stopped
  staticAudio.pause()
  staticAudio.currentTime = 0
}

// Generate a random ID
function generateRandomId() {
  return Math.random().toString(36).substr(2, 9)
}

// Initialize the app
function init() {
  statusEl.textContent = "Desconectado"
  statusEl.className = "status disconnected"

  // Load saved username and room
  const savedUsername = localStorage.getItem("walkie-talkie-username")
  if (savedUsername) {
    username = savedUsername
    usernameInput.value = username
  }

  const savedRoom = localStorage.getItem("walkie-talkie-room")
  if (savedRoom) {
    roomId = savedRoom
    roomIdInput.value = roomId
    channelDisplay.textContent = `Canal: ${roomId}`
  }

  // Set initial volume
  volumeControl.value = 0.7
  startToneAudio.volume = 0.7
  endToneAudio.volume = 0.7
  staticAudio.volume = 0.2

  // Preload audio
  startToneAudio.load()
  endToneAudio.load()
  staticAudio.load()

  // Check if browser supports required APIs
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    alert("Tu navegador no soporta las funciones de audio necesarias para esta aplicación.")
    connectBtn.disabled = true
    talkBtn.disabled = true
  }
}

// Start the app
init()
