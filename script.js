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
const myIdDisplay = document.getElementById("my-id")
const connectionState = document.getElementById("connection-state")
const peerIdInput = document.getElementById("peer-id")
const connectToPeerBtn = document.getElementById("connect-to-peer")
const logContainer = document.getElementById("log-container")

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
const roomId = "corazones-abiertos"
let isConnected = false
let isTalking = false

// Add log message
function addLog(message) {
  const logEntry = document.createElement("div")
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`
  logContainer.appendChild(logEntry)
  logContainer.scrollTop = logContainer.scrollHeight
}

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

    addLog(`Nombre cambiado a: ${username}`)
  }
})

// Room joining
// joinRoomBtn.addEventListener("click", () => {
//   const newRoomId = roomIdInput.value.trim()
//   if (newRoomId && newRoomId !== roomId) {
//     // If already connected, disconnect first
//     if (isConnected) {
//       disconnectCall()
//       isConnected = false
//       connectBtn.textContent = "Conectar"
//       statusEl.textContent = "Desconectado"
//       statusEl.className = "status disconnected"
//     }

//     roomId = newRoomId
//     localStorage.setItem("walkie-talkie-room", roomId)
//     channelDisplay.textContent = `Canal: ${roomId}`

//     alert(`Te has unido al canal: ${roomId}`)
//   }
// })

// Connect to specific peer
connectToPeerBtn.addEventListener("click", () => {
  const peerId = peerIdInput.value.trim()
  if (peerId && isConnected) {
    addLog(`Intentando conectar con: ${peerId}`)
    connectToPeer(peerId)
  } else if (!isConnected) {
    alert("Primero debes conectarte haciendo clic en 'Conectar'")
  } else {
    alert("Por favor ingresa un ID válido")
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
      connectionState.textContent = "Conectado"
      talkBtn.disabled = false

      // Add self to participants list
      updateParticipantsList()
    } catch (error) {
      console.error("Error connecting:", error)
      statusEl.textContent = "Error al conectar"
      statusEl.className = "status disconnected"
      connectionState.textContent = "Error: " + error.message
      addLog(`Error de conexión: ${error.message}`)
    }
  } else {
    disconnectCall()
    isConnected = false
    connectBtn.textContent = "Conectar"
    statusEl.textContent = "Desconectado"
    statusEl.className = "status disconnected"
    connectionState.textContent = "Desconectado"
    talkBtn.disabled = true
    myIdDisplay.textContent = "No conectado"

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

  addLog("Transmitiendo audio...")
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

  addLog("Transmisión finalizada")
}

// Setup WebRTC connection
async function setupConnection() {
  statusEl.textContent = "Conectando..."
  statusEl.className = "status connecting"
  connectionState.textContent = "Conectando..."

  try {
    // Get user media (microphone)
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    })

    addLog("Micrófono conectado correctamente")

    // Initialize PeerJS - using a random ID
    const peerId = generateRandomId()
    peer = new Peer(peerId, {
      debug: 2, // Log level
    })

    return new Promise((resolve, reject) => {
      peer.on("open", (id) => {
        console.log("My peer ID is: " + id)
        myIdDisplay.textContent = id
        addLog(`Conectado con ID: ${id}`)
        channelDisplay.textContent = `Canal: ${roomIdInput.value}`

        // Set up event listeners for peer connections
        setupPeerEventListeners()

        resolve()
      })

      peer.on("error", (err) => {
        console.error("Peer connection error:", err)
        addLog(`Error de PeerJS: ${err.type}`)
        reject(err)
      })
    })
  } catch (error) {
    console.error("Error setting up media devices:", error)
    addLog(`Error de acceso al micrófono: ${error.message}`)
    throw error
  }
}

// Set up peer event listeners
function setupPeerEventListeners() {
  // Handle incoming connections
  peer.on("connection", (conn) => {
    addLog(`Conexión entrante de: ${conn.peer}`)
    handleConnection(conn)
  })

  // Handle incoming calls
  peer.on("call", (call) => {
    addLog(`Llamada entrante de: ${call.peer}`)

    // Answer the call with our local stream
    call.answer(localStream)

    // Handle the incoming audio stream
    call.on("stream", (remoteStream) => {
      addLog(`Recibiendo audio de: ${call.peer}`)

      // Create an audio element to play the remote stream
      const audio = new Audio()
      audio.srcObject = remoteStream
      audio.autoplay = true

      // Store the audio element with the connection
      if (connections[call.peer]) {
        connections[call.peer].audio = audio
      }
    })

    call.on("error", (err) => {
      addLog(`Error en llamada: ${err}`)
    })

    // Store the call
    if (connections[call.peer]) {
      connections[call.peer].call = call
    } else {
      // If we don't have a data connection yet, create a placeholder
      connections[call.peer] = {
        call: call,
        username: "Usuario desconocido",
        isTalking: false,
      }

      // Initiate a data connection back
      connectToPeer(call.peer)
    }
  })

  peer.on("disconnected", () => {
    addLog("Desconectado del servidor. Intentando reconectar...")
    peer.reconnect()
  })

  peer.on("close", () => {
    addLog("Conexión cerrada")
  })
}

// Join a room
// function joinRoom(roomId) {
//   // In a real app, you would use a signaling server to discover peers in the room
//   // For this demo, we'll use a simple approach with PeerJS's random IDs

//   // Connect to any existing peers in the room
//   // This would normally be handled by a signaling server
//   // For demo purposes, we'll just update the UI
//   updateParticipantsList()
// }

// Connect to a specific peer
function connectToPeer(peerId) {
  if (connections[peerId] && connections[peerId].conn) {
    addLog(`Ya estás conectado con: ${peerId}`)
    return
  }

  addLog(`Conectando con: ${peerId}`)

  // Create a data connection
  const conn = peer.connect(peerId, {
    reliable: true,
  })

  handleConnection(conn)

  // Also create a media connection (call)
  if (localStream) {
    const call = peer.call(peerId, localStream)

    call.on("stream", (remoteStream) => {
      addLog(`Recibiendo audio de: ${peerId}`)

      // Create an audio element to play the remote stream
      const audio = new Audio()
      audio.srcObject = remoteStream
      audio.autoplay = true

      // Store the audio element with the connection
      if (connections[peerId]) {
        connections[peerId].audio = audio
      }
    })

    call.on("error", (err) => {
      addLog(`Error en llamada: ${err}`)
    })

    // Store the call
    if (connections[peerId]) {
      connections[peerId].call = call
    }
  }
}

// Handle a new data connection
function handleConnection(conn) {
  // Store the connection
  connections[conn.peer] = connections[conn.peer] || {}
  connections[conn.peer].conn = conn
  connections[conn.peer].username = connections[conn.peer].username || "Usuario"
  connections[conn.peer].isTalking = connections[conn.peer].isTalking || false

  // Set up connection event listeners
  conn.on("open", () => {
    addLog(`Conexión establecida con: ${conn.peer}`)

    // Send our username to the new peer
    conn.send({
      type: "username",
      username: username,
    })

    updateParticipantsList()
  })

  conn.on("data", (data) => {
    handlePeerMessage(conn.peer, data)
  })

  conn.on("close", () => {
    addLog(`Conexión cerrada con: ${conn.peer}`)
    delete connections[conn.peer]
    updateParticipantsList()
  })

  conn.on("error", (err) => {
    addLog(`Error en conexión con ${conn.peer}: ${err}`)
  })
}

// Start broadcasting audio to all peers
function startAudioBroadcast() {
  Object.keys(connections).forEach((peerId) => {
    // Call the peer if we haven't already
    if (!connections[peerId].call && localStream) {
      addLog(`Iniciando llamada con: ${peerId}`)
      const call = peer.call(peerId, localStream)
      connections[peerId].call = call

      call.on("error", (err) => {
        addLog(`Error en llamada a ${peerId}: ${err}`)
      })
    }
  })
}

// Stop broadcasting audio
function stopAudioBroadcast() {
  // In WebRTC, we can't easily stop the audio stream without closing the connection
  // The talking-stop message will let peers know to ignore the audio
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
      addLog(`${peerId} se identifica como: ${data.username}`)
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

      addLog(`${data.username} está hablando...`)
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

      addLog(`${data.username} terminó de hablar`)
      break

    case "name-change":
      connections[peerId].username = data.newName
      addLog(`${data.oldName} cambió su nombre a ${data.newName}`)
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
    const peerData = connections[peerId]
    const li = document.createElement("li")
    li.textContent = peerData.username
    if (peerData.isTalking) {
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

    // Stop any audio elements
    if (connections[peerId].audio) {
      connections[peerId].audio.srcObject = null
      connections[peerId].audio.pause()
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

  addLog("Desconectado de todos los pares")
}

// Generate a random ID
function generateRandomId() {
  return Math.random().toString(36).substr(2, 9)
}

// Initialize the app
function init() {
  statusEl.textContent = "Desconectado"
  statusEl.className = "status disconnected"
  connectionState.textContent = "Desconectado"

  // Load saved username
  const savedUsername = localStorage.getItem("walkie-talkie-username")
  if (savedUsername) {
    username = savedUsername
    usernameInput.value = username
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
    addLog("ERROR: Tu navegador no es compatible con esta aplicación")
  } else {
    addLog("Aplicación inicializada. Haz clic en 'Conectar' para comenzar.")
  }
}

// Start the app
init()
