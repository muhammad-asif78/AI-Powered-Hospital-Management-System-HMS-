// script.js
// Simple typing indicator animation (already CSS handles bounce)
// For demonstration, toggle typing indicator after a delay

document.addEventListener('DOMContentLoaded', () => {
  const typing = document.getElementById('typingIndicator');
  setTimeout(() => {
    // Hide typing after 3 seconds and simulate AI reply
    typing.style.display = 'none';
    const chatBody = document.getElementById('chatBody');
    const aiMessage = document.createElement('div');
    aiMessage.className = 'message ai';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = "I recommend taking a short nap and staying hydrated. If pain persists, consider seeing a doctor.";
    aiMessage.appendChild(bubble);
    chatBody.appendChild(aiMessage);
    chatBody.scrollTop = chatBody.scrollHeight;
  }, 3000);
});

// Orb pulse state changes (listening / thinking / responding)
let orbState = 'listening'; // could be 'listening', 'thinking', 'responding'
const orb = document.getElementById('orb');
function setOrbState(state) {
  orbState = state;
  switch(state) {
    case 'listening':
      orb.style.boxShadow = '0 0 30px rgba(154,93,229,0.6), 0 0 60px rgba(0,245,212,0.4)';
      break;
    case 'thinking':
      orb.style.boxShadow = '0 0 30px rgba(58,134,255,0.7), 0 0 60px rgba(154,93,229,0.5)';
      break;
    case 'responding':
      orb.style.boxShadow = '0 0 30px rgba(0,245,212,0.7), 0 0 60px rgba(58,134,255,0.5)';
      break;
    default:
      break;
  }
}
// Example cycle (optional)
setInterval(() => {
  const states = ['listening', 'thinking', 'responding'];
  const next = states[(states.indexOf(orbState) + 1) % states.length];
  setOrbState(next);
}, 5000);
