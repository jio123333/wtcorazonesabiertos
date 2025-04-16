let username = "Anónimo";
const statusEl = document.getElementById("status");
const talkButton = document.getElementById("talkButton");
const radioSound = document.getElementById("radioSound");

document.getElementById("updateName").addEventListener("click", () => {
  const nameInput = document.getElementById("username").value.trim();
  if (nameInput) {
    username = nameInput;
    statusEl.textContent = `Nombre actualizado a: ${username}`;
  }
});

let localStream;

// Obtener audio y preparar la transmisión
async function initAudio() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    statusEl.textContent = "Listo para hablar.";
  } catch (err) {
    statusEl.textContent = "Error accediendo al micrófono.";
    console.error(err);
  }
}

// Simula apretar el botón para hablar
talkButton.addEventListener("mousedown", () => {
  if (localStream) {
    radioSound.currentTime = 0;
    radioSound.play();
    const track = localStream.getAudioTracks()[0];
    track.enabled = true;
    statusEl.textContent = `${username} está hablando...`;
  }
});

talkButton.addEventListener("mouseup", () => {
  if (localStream) {
    const track = localStream.getAudioTracks()[0];
    track.enabled = false;
    statusEl.textContent = "Micrófono apagado.";
  }
});

initAudio();
