// Verificar si PeerJS está disponible
if (typeof Peer === "undefined") {
    alert(
      "Error: No se pudo cargar la biblioteca PeerJS. Por favor, verifica tu conexión a internet y vuelve a cargar la página.",
    )
  }
  
  // DOM Elements
  const connectBtn = document.getElementById("connect-btn")
  const talkBtn = document.getElementById("talk-btn")
  const statusEl = document.getElementById("status")
  const activeUserEl = document.getElementById("active-user")
  const volumeControl = document.getElementById("volume")
  const participantsList = document.getElementById("participants-list")
  const usernameInput = document.getElementById("username")
  const editUsernameBtn = document.getElementById("edit-username")
  const myIdDisplay = document.getElementById("my-id")
  const connectionState = document.getElementById("connection-state")
  const peerIdInput = document.getElementById("peer-id")
  const connectToPeerBtn = document.getElementById("connect-to-peer")
  const logContainer = document.getElementById("log-container")
  const clearLogBtn = document.getElementById("clear-log")
  
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
  let isConnected = false
  let isTalking = false
  let microphoneReady = false
  
  // Precarga de sonidos
  function preloadSounds() {
    addLog("Precargando sonidos...")
  
    const preloadPromises = [
      new Promise((resolve) => {
        startToneAudio.addEventListener("canplaythrough", resolve, { once: true })
        startToneAudio.load()
      }),
      new Promise((resolve) => {
        endToneAudio.addEventListener("canplaythrough", resolve, { once: true })
        endToneAudio.load()
      }),
      new Promise((resolve) => {
        staticAudio.addEventListener("canplaythrough", resolve, { once: true })
        staticAudio.load()
      }),
    ]
  
    Promise.all(preloadPromises)
      .then(() => {
        addLog("Sonidos cargados correctamente")
      })
      .catch((error) => {
        addLog("Error al cargar sonidos: " + error.message)
      })
  }
  
  // Add log message
  function addLog(message) {
    const logEntry = document.createElement("div")
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`
    logContainer.appendChild(logEntry)
    logContainer.scrollTop = logContainer.scrollHeight
  }
  
  // Clear log
  clearLogBtn.addEventListener("click", () => {
    logContainer.innerHTML = ""
    addLog("Registro limpiado")
  })
  
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
        connectBtn.disabled = true
        connectBtn.textContent = "Conectando..."
        statusEl.textContent = "Conectando..."
        statusEl.className = "status connecting"
        connectionState.textContent = "Conectando..."
  
        await setupConnection()
  
        isConnected = true
        connectBtn.textContent = "Desconectar"
        connectBtn.disabled = false
        statusEl.textContent = "Conectado"
        statusEl.className = "status connected"
        connectionState.textContent = "Conectado"
        talkBtn.disabled = !microphoneReady
  
        if (!microphoneReady) {
          addLog("ADVERTENCIA: Micrófono no disponible. No podrás hablar.")
        }
  
        // Add self to participants list
        updateParticipantsList()
      } catch (error) {
        console.error("Error connecting:", error)
        statusEl.textContent = "Error al conectar"
        statusEl.className = "status disconnected"
        connectionState.textContent = "Error: " + error.message
        addLog(`Error de conexión: ${error.message}`)
  
        connectBtn.disabled = false
        connectBtn.textContent = "Conectar"
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
    if (!isConnected || isTalking || !microphoneReady) return
  
    isTalking = true
    talkBtn.classList.add("active")
  
    // Play start tone (walkie-talkie beep)
    try {
      startToneAudio.currentTime = 0
      const playPromise = startToneAudio.play()
  
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          addLog(`Error al reproducir sonido: ${error}`)
        })
      }
    } catch (error) {
      addLog(`Error al reproducir sonido de inicio: ${error.message}`)
    }
  
    // Play static sound in the background
    setTimeout(() => {
      if (isTalking) {
        try {
          staticAudio.currentTime = 0
          const playPromise = staticAudio.play()
  
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              addLog(`Error al reproducir estática: ${error}`)
            })
          }
        } catch (error) {
          addLog(`Error al reproducir estática: ${error.message}`)
        }
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
    try {
      staticAudio.pause()
      staticAudio.currentTime = 0
    } catch (error) {
      addLog(`Error al detener estática: ${error.message}`)
    }
  
    // Play end tone (walkie-talkie end beep)
    try {
      endToneAudio.currentTime = 0
      const playPromise = endToneAudio.play()
  
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          addLog(`Error al reproducir sonido final: ${error}`)
        })
      }
    } catch (error) {
      addLog(`Error al reproducir sonido final: ${error.message}`)
    }
  
    // Broadcast that we've stopped talking
    broadcastMessage({
      type: "talking-stop",
      username: username,
    })
  
    // Stop sending audio
    stopAudioBroadcast()
  
    addLog("Transmisión finalizada")
  }
  
  // Setup microphone access
  async function setupMicrophone() {
    try {
      addLog("Solicitando acceso al micrófono...")
  
      // Get user media (microphone)
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })
  
      microphoneReady = true
      addLog("✅ Micrófono conectado correctamente")
      return true
    } catch (error) {
      console.error("Error accessing microphone:", error)
      addLog(`❌ Error de acceso al micrófono: ${error.message}`)
  
      // Continue without microphone
      microphoneReady = false
      return false
    }
  }
  
  // Setup WebRTC connection
  async function setupConnection() {
    try {
      // Try to set up microphone, but continue even if it fails
      await setupMicrophone()
  
      addLog("Inicializando conexión PeerJS...")
  
      // Initialize PeerJS - using a random ID
      const peerId = generateRandomId()
  
      return new Promise((resolve, reject) => {
        try {
          // Create Peer with more robust error handling
          peer = new Peer(peerId, {
            debug: 1, // Less verbose logging
            config: {
              iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
            },
          })
  
          // Set timeout for connection
          const connectionTimeout = setTimeout(() => {
            reject(new Error("Tiempo de conexión agotado. Verifica tu conexión a internet."))
          }, 15000)
  
          peer.on("open", (id) => {
            clearTimeout(connectionTimeout)
            console.log("My peer ID is: " + id)
            myIdDisplay.textContent = id
            addLog(`✅ Conectado con ID: ${id}`)
  
            // Set up event listeners for peer connections
            setupPeerEventListeners()
  
            resolve()
          })
  
          peer.on("error", (err) => {
            clearTimeout(connectionTimeout)
            console.error("Peer connection error:", err)
            addLog(`❌ Error de PeerJS: ${err.type}`)
            reject(err)
          })
        } catch (error) {
          addLog(`❌ Error al crear objeto Peer: ${error.message}`)
          reject(error)
        }
      })
    } catch (error) {
      console.error("Error in setupConnection:", error)
      addLog(`❌ Error en setupConnection: ${error.message}`)
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
  
      try {
        // Answer the call with our local stream if available
        if (microphoneReady && localStream) {
          call.answer(localStream)
          addLog("Llamada contestada con audio local")
        } else {
          // Answer with empty stream if no microphone
          call.answer()
          addLog("Llamada contestada sin audio (micrófono no disponible)")
        }
  
        // Handle the incoming audio stream
        call.on("stream", (remoteStream) => {
          addLog(`Recibiendo audio de: ${call.peer}`)
  
          try {
            // Create an audio element to play the remote stream
            const audio = new Audio()
            audio.srcObject = remoteStream
            audio.autoplay = true
  
            // Store the audio element with the connection
            if (connections[call.peer]) {
              connections[call.peer].audio = audio
            }
          } catch (error) {
            addLog(`Error al procesar audio entrante: ${error.message}`)
          }
        })
  
        call.on("error", (err) => {
          addLog(`Error en llamada: ${err}`)
        })
  
        call.on("close", () => {
          addLog(`Llamada cerrada con: ${call.peer}`)
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
      } catch (error) {
        addLog(`Error al procesar llamada entrante: ${error.message}`)
      }
    })
  
    peer.on("disconnected", () => {
      addLog("Desconectado del servidor. Intentando reconectar...")
      try {
        peer.reconnect()
      } catch (error) {
        addLog(`Error al reconectar: ${error.message}`)
      }
    })
  
    peer.on("close", () => {
      addLog("Conexión cerrada")
    })
  }
  
  // Connect to a specific peer
  function connectToPeer(peerId) {
    if (connections[peerId] && connections[peerId].conn) {
      addLog(`Ya estás conectado con: ${peerId}`)
      return
    }
  
    addLog(`Conectando con: ${peerId}`)
  
    try {
      // Create a data connection
      const conn = peer.connect(peerId, {
        reliable: true,
      })
  
      if (!conn) {
        addLog(`❌ No se pudo crear conexión con: ${peerId}`)
        return
      }
  
      handleConnection(conn)
  
      // Also create a media connection (call) if we have microphone access
      if (microphoneReady && localStream) {
        try {
          const call = peer.call(peerId, localStream)
  
          call.on("stream", (remoteStream) => {
            addLog(`Recibiendo audio de: ${peerId}`)
  
            try {
              // Create an audio element to play the remote stream
              const audio = new Audio()
              audio.srcObject = remoteStream
              audio.autoplay = true
  
              // Store the audio element with the connection
              if (connections[peerId]) {
                connections[peerId].audio = audio
              }
            } catch (error) {
              addLog(`Error al procesar audio: ${error.message}`)
            }
          })
  
          call.on("error", (err) => {
            addLog(`Error en llamada: ${err}`)
          })
  
          // Store the call
          if (connections[peerId]) {
            connections[peerId].call = call
          }
        } catch (error) {
          addLog(`Error al iniciar llamada: ${error.message}`)
        }
      } else {
        addLog("No se inició llamada de audio (micrófono no disponible)")
      }
    } catch (error) {
      addLog(`❌ Error al conectar con peer: ${error.message}`)
    }
  }
  
  // Handle a new data connection
  function handleConnection(conn) {
    try {
      // Store the connection
      connections[conn.peer] = connections[conn.peer] || {}
      connections[conn.peer].conn = conn
      connections[conn.peer].username = connections[conn.peer].username || "Usuario"
      connections[conn.peer].isTalking = connections[conn.peer].isTalking || false
  
      // Set up connection event listeners
      conn.on("open", () => {
        addLog(`✅ Conexión establecida con: ${conn.peer}`)
  
        // Send our username to the new peer
        try {
          conn.send({
            type: "username",
            username: username,
          })
        } catch (error) {
          addLog(`Error al enviar nombre de usuario: ${error.message}`)
        }
  
        updateParticipantsList()
      })
  
      conn.on("data", (data) => {
        try {
          handlePeerMessage(conn.peer, data)
        } catch (error) {
          addLog(`Error al procesar mensaje: ${error.message}`)
        }
      })
  
      conn.on("close", () => {
        addLog(`Conexión cerrada con: ${conn.peer}`)
        delete connections[conn.peer]
        updateParticipantsList()
      })
  
      conn.on("error", (err) => {
        addLog(`Error en conexión con ${conn.peer}: ${err}`)
      })
    } catch (error) {
      addLog(`Error al manejar conexión: ${error.message}`)
    }
  }
  
  // Start broadcasting audio to all peers
  function startAudioBroadcast() {
    if (!microphoneReady || !localStream) {
      addLog("No se puede transmitir audio (micrófono no disponible)")
      return
    }
  
    Object.keys(connections).forEach((peerId) => {
      // Call the peer if we haven't already
      if (!connections[peerId].call && localStream) {
        try {
          addLog(`Iniciando llamada con: ${peerId}`)
          const call = peer.call(peerId, localStream)
          connections[peerId].call = call
  
          call.on("error", (err) => {
            addLog(`Error en llamada a ${peerId}: ${err}`)
          })
        } catch (error) {
          addLog(`Error al iniciar llamada con ${peerId}: ${error.message}`)
        }
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
        try {
          connection.send(message)
        } catch (error) {
          addLog(`Error al enviar mensaje a ${peerId}: ${error.message}`)
        }
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
        try {
          startToneAudio.currentTime = 0
          startToneAudio.play().catch((err) => {
            addLog(`Error al reproducir tono inicial: ${err.message}`)
          })
  
          // Play static
          setTimeout(() => {
            if (connections[peerId] && connections[peerId].isTalking) {
              staticAudio.currentTime = 0
              staticAudio.play().catch((err) => {
                addLog(`Error al reproducir estática: ${err.message}`)
              })
            }
          }, 300)
        } catch (error) {
          addLog(`Error al reproducir sonidos: ${error.message}`)
        }
  
        addLog(`${data.username} está hablando...`)
        break
  
      case "talking-stop":
        connections[peerId].isTalking = false
        activeUserEl.textContent = ""
        updateParticipantsList()
  
        // Stop static
        try {
          staticAudio.pause()
          staticAudio.currentTime = 0
  
          // Play end tone
          endToneAudio.currentTime = 0
          endToneAudio.play().catch((err) => {
            addLog(`Error al reproducir tono final: ${err.message}`)
          })
        } catch (error) {
          addLog(`Error al detener sonidos: ${error.message}`)
        }
  
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
      if (peerData.conn && peerData.conn.open) {
        const li = document.createElement("li")
        li.textContent = peerData.username
        if (peerData.isTalking) {
          li.classList.add("talking")
        }
        participantsList.appendChild(li)
      }
    })
  }
  
  // Disconnect call
  function disconnectCall() {
    // Close all peer connections
    if (peer) {
      try {
        peer.destroy()
      } catch (error) {
        addLog(`Error al destruir peer: ${error.message}`)
      }
      peer = null
    }
  
    // Close all connections
    Object.keys(connections).forEach((peerId) => {
      try {
        const connection = connections[peerId].conn
        if (connection && connection.open) {
          connection.close()
        }
  
        // Stop any audio elements
        if (connections[peerId].audio) {
          connections[peerId].audio.srcObject = null
          connections[peerId].audio.pause()
        }
      } catch (error) {
        addLog(`Error al cerrar conexión con ${peerId}: ${error.message}`)
      }
    })
    connections = {}
  
    // Stop local stream
    if (localStream) {
      try {
        localStream.getTracks().forEach((track) => track.stop())
      } catch (error) {
        addLog(`Error al detener stream local: ${error.message}`)
      }
      localStream = null
    }
  
    // Make sure all audio is stopped
    try {
      staticAudio.pause()
      staticAudio.currentTime = 0
    } catch (error) {
      addLog(`Error al detener audio: ${error.message}`)
    }
  
    addLog("Desconectado de todos los pares")
  }
  
  // Generate a random ID
  function generateRandomId() {
    return "user-" + Math.random().toString(36).substr(2, 9)
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
    preloadSounds()
  
    // Check if browser supports required APIs
    if (!navigator.mediaDevices) {
      addLog("⚠️ ADVERTENCIA: Tu navegador no soporta acceso al micrófono. Podrás escuchar pero no hablar.")
    }
  
    if (typeof Peer === "undefined") {
      addLog("❌ ERROR: No se pudo cargar la biblioteca PeerJS. Verifica tu conexión a internet.")
      connectBtn.disabled = true
      alert(
        "Error: No se pudo cargar la biblioteca PeerJS. Por favor, verifica tu conexión a internet y vuelve a cargar la página.",
      )
    } else {
      addLog("Aplicación inicializada. Haz clic en 'Conectar' para comenzar.")
    }
  }
  
  // Start the app
  init()
  