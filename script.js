// DOM Elements
const connectBtn = document.getElementById("connect-btn")
const talkBtn = document.getElementById("talk-btn")
const statusEl = document.getElementById("status")
const volumeControl = document.getElementById("volume")
const participantsList = document.getElementById("participants-list")

// Audio elements for radio sound effects
const startToneAudio = new Audio()
startToneAudio.src = "https://cdn.freesound.org/previews/459/459149_4768586-lq.mp3" // Radio start beep

const endToneAudio = new Audio()
endToneAudio.src = "https://cdn.freesound.org/previews/459/459148_4768586-lq.mp3" // Radio end beep

const staticAudio = new Audio()
staticAudio.src = "https://cdn.freesound.org/previews/234/234988_4568611-lq.mp3" // Radio static noise
staticAudio.loop = true

// Variables for audio streaming
let isConnected = false
let isTalking = false
let localStream = null
let peerConnections = {}
const roomId = "corazones-abiertos-channel"
const userId = generateUserId()
let mediaRecorder = null
let audioContext = null
let audioDestination = null

// Set initial volume
volumeControl.addEventListener("input", () => {
  const volume = volumeControl.value
  startToneAudio.volume = volume
  endToneAudio.volume = volume
  staticAudio.volume = volume * 0.3 // Lower volume for static
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

      // Add self to participants list
      addParticipant("Tú (Local)")

      // Simulate other participants for demo
      setTimeout(() => {
        addParticipant("Voluntario 1")
        addParticipant("Voluntario 2")
      }, 1500)
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

    // Clear participants list
    participantsList.innerHTML = ""
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
  if (!isConnected) return

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

  // Start broadcasting audio if connected
  if (mediaRecorder && mediaRecorder.state === "inactive") {
    mediaRecorder.start(100)
  }
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

  // Stop broadcasting audio
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop()
  }
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

    // Setup audio context for processing
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
    audioDestination = audioContext.createMediaStreamDestination()

    // Create media recorder
    mediaRecorder = new MediaRecorder(localStream)

    // Handle data available event
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        // In a real app, this would send the audio data to peers
        console.log("Audio data available:", event.data.size, "bytes")

        // Simulate receiving a response after talking (for demo purposes)
        if (!isTalking && Math.random() > 0.7) {
          setTimeout(() => {
            simulateIncomingTransmission()
          }, 2000)
        }
      }
    }

    return true
  } catch (error) {
    console.error("Error setting up media devices:", error)
    throw error
  }
}

// Simulate incoming transmission (for demo purposes)
function simulateIncomingTransmission() {
  if (!isConnected) return

  // Play incoming transmission sounds
  startToneAudio.currentTime = 0
  startToneAudio.play()

  // Show who's talking
  const sender = Math.random() > 0.5 ? "Voluntario 1" : "Voluntario 2"
  const tempStatus = statusEl.textContent
  statusEl.textContent = `${sender} está hablando...`

  // Play static for a moment
  setTimeout(() => {
    staticAudio.currentTime = 0
    staticAudio.play()
  }, 300)

  // End the transmission after a random time
  const duration = 1500 + Math.random() * 2000
  setTimeout(() => {
    staticAudio.pause()
    staticAudio.currentTime = 0

    endToneAudio.currentTime = 0
    endToneAudio.play()

    // Restore status
    setTimeout(() => {
      statusEl.textContent = tempStatus
    }, 500)
  }, duration)
}

// Disconnect call
function disconnectCall() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop())
    localStream = null
  }

  if (mediaRecorder) {
    if (mediaRecorder.state === "recording") {
      mediaRecorder.stop()
    }
    mediaRecorder = null
  }

  if (audioContext) {
    audioContext.close()
    audioContext = null
  }

  // Make sure all audio is stopped
  staticAudio.pause()
  staticAudio.currentTime = 0

  peerConnections = {}
}

// Add participant to the list
function addParticipant(name) {
  const li = document.createElement("li")
  li.textContent = name
  participantsList.appendChild(li)
}

// Generate a random user ID
function generateUserId() {
  return "user_" + Math.random().toString(36).substr(2, 9)
}

// Initialize the app
function init() {
  statusEl.textContent = "Desconectado"
  statusEl.className = "status disconnected"

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
