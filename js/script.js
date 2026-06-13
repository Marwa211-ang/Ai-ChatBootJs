
   
const chatbox = document.querySelector(".chatbox");
const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.getElementById("send-btn");
const chatToggler = document.querySelector(".chat-toggler");
const closeBtn = document.querySelector(".close-btn");
const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const chatbotContainer = document.querySelector(".chatbot");
const clearBtn = document.getElementById("clear-btn");

let pickedMedia = null; 
let extractedText = null; // متغير جديد لحفظ النص الصريح فوراً وتخفيف الضغط

let chatHistory = JSON.parse(localStorage.getItem("chat-history")) || [];

// 1. دالة إرسال الطلب لـ Gemini
function generateResponse(incomingLi, userMessage, mediaFile = null) {
  let API_KEY = typeof CONFIG_API_KEY !== "undefined" ? CONFIG_API_KEY : localStorage.getItem("gemini-api-key");
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const parts = [{ text: userMessage }];
  if (mediaFile && mediaFile.mimeType.startsWith("image/")) {
    parts.push({ inlineData: { mimeType: mediaFile.mimeType, data: mediaFile.base64Data } });
  }

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: parts }] })
  };

  fetch(API_URL, requestOptions)
    .then(res => res.json())
    .then(data => {
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        let replyText = data.candidates[0].content.parts[0].text;
        replyText = replyText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
        incomingLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>${replyText}</p>`;
        chatHistory.push({ role: "model", text: replyText });
        localStorage.setItem("chat-history", JSON.stringify(chatHistory));
      } else if (data.error) {
        incomingLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>جوجل بيقول: ${data.error.message}</p>`;
      } else {
        incomingLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>فهمتك، بس ياريت توضحي سؤالك أكتر.</p>`;
      }
    })
    .catch(() => {
      incomingLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>عذراً، حصلت مشكلة في الاتصال بالـ API.</p>`;
    })
    .finally(() => {
      // إعادة تفعيل الزرار فوراً بعد انتهاء الطلب
      if (sendChatBtn) {
        sendChatBtn.style.pointerEvents = "auto";
        sendChatBtn.style.opacity = "1";
      }
      chatbox.scrollTo(0, chatbox.scrollHeight);
    });
}

// 2. دالة التحكم في الشات (خفيفة جداً وسريعة)
const handleChat = () => {
  if (!chatInput || sendChatBtn.style.pointerEvents === "none") return;
  
  const typedMessage = chatInput.value.trim(); 
  let userMessage = typedMessage; 
  
  if (!userMessage && !pickedMedia && !extractedText) return;
  
  // قفل الزرار فورا لمنع الـ Double Click
  if (sendChatBtn) {
    sendChatBtn.style.pointerEvents = "none";
    sendChatBtn.style.opacity = "0.5";
  }

  // لو النص جاهز مسبقاً، بندمجه فوراً بدون عمليات معالجة تقيلة
  if (extractedText) {
    const systemInstruction = `
[System Instruction / نظام تحليل الملفات الذكي]:
You are an expert document and code analyzer. You support both Arabic and English.
Respond in the same language the user uses. If the user asks "what is the most important part", extract it.

[Attached File Content / محتوى الملف المرفق]:
${extractedText}
--------------------------------------------------`;
    userMessage = typedMessage ? `${systemInstruction}\n[User Question]: ${typedMessage}` : `${systemInstruction}\n[User Question]: قم بتحليل هذا الملف واستخرج أهم جزء فيه.`;
  }

  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", "outgoing");
  
  if (pickedMedia && pickedMedia.mimeType.startsWith("image/")) {
    chatLi.innerHTML = `<div class="message-content" style="display: flex; flex-direction: column; gap: 8px;">
        <img src="data:${pickedMedia.mimeType};base64,${pickedMedia.base64Data}" style="max-width: 180px; max-height: 180px; border-radius: 12px; object-fit: cover; align-self: flex-end;">
        ${typedMessage ? `<p style="margin: 0; word-break: break-word;">${typedMessage}</p>` : ''}
      </div>`;
  } else if (extractedText) {
    chatLi.innerHTML = `<p>${typedMessage || "تحليل الملف النصي"} <br><small>📄 تم إرفاق ملف نصي</small></p>`;
  } else {
    chatLi.innerHTML = `<p>${userMessage}</p>`;
  }
  
  chatbox.appendChild(chatLi);
  chatHistory.push({ role: "user", text: chatLi.innerHTML, isHTML: true });
  localStorage.setItem("chat-history", JSON.stringify(chatHistory));

  chatInput.value = ""; 
  chatbox.scrollTo(0, chatbox.scrollHeight);

  const incomingLi = document.createElement("li");
  incomingLi.classList.add("chat", "incoming");
  incomingLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><div class="typing-animation"><span></span><span></span><span></span></div>`;
  chatbox.appendChild(incomingLi);
  chatbox.scrollTo(0, chatbox.scrollHeight);

  generateResponse(incomingLi, userMessage, pickedMedia);

  // تنظيف المتغيرات
  pickedMedia = null;
  extractedText = null;
  if (uploadBtn) uploadBtn.style.color = "#706fd3"; 
  if (fileInput) fileInput.value = "";
};

// 3. مراقب اختيار الملفات (بيدير العمليات التقيلة أثناء الاختيار وليس أثناء الضغط)
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0]; 
    if (!file) return; 

    const reader = new FileReader(); 
    
    if (file.type.startsWith("image/")) {
      reader.onload = (e) => {
        pickedMedia = { mimeType: file.type, base64Data: e.target.result.split(",")[1] };
        extractedText = null;
        if (uploadBtn) uploadBtn.style.color = "#2ecc71"; 
      };
      reader.readAsDataURL(file); 
    } else {
      // بنقرأ الفايل كنص صريح ونقصه هنا ببطء براحتنا قبل ما المستخدم يدوس إرسال
      reader.onload = (e) => {
        extractedText = e.target.result.substring(0, 8000); 
        pickedMedia = null;
        if (uploadBtn) uploadBtn.style.color = "#3498db"; 
        console.log("الملف النصي جاهز تماماً في الخلفية!");
      };
      reader.readAsText(file); 
    }
  });
}

// باقي الـ Event Listeners كما هي بدون تغيير
if (sendChatBtn) sendChatBtn.addEventListener("click", handleChat);
if (chatToggler) chatToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));
if (closeBtn) closeBtn.addEventListener("click", () => document.body.classList.remove("show-chatbot"));
if (chatInput) {
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); }
  });
}
if (fullscreenBtn && chatbotContainer) {
  fullscreenBtn.addEventListener("click", () => {
    chatbotContainer.classList.toggle("fullscreen");
    fullscreenBtn.textContent = chatbotContainer.classList.contains("fullscreen") ? "fullscreen_exit" : "fullscreen";
  });
}
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (confirm("هل أنت متأكد من رغبتك في مسح المحادثة بالكامل؟")) {
      localStorage.removeItem("chat-history");
      chatHistory = [];
      chatbox.innerHTML = `<li class="chat incoming"><span class="material-symbols-outlined">smart_toy</span><p>Hello! How can I help you today? ✨</p></li>`;
    }
  });
}
