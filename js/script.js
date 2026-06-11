
   
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
let pickedMedia = null; // هنوحد المتغير للصور والملفات النصية كـ Base64

// مصفوفة لتخزين تاريخ المحادثة
let chatHistory = JSON.parse(localStorage.getItem("chat-history")) || [];

// 1. دالة إرسال الطلب لـ Gemini ومعالجة الرد وتنسيقه
function generateResponse(incomingLi, userMessage, mediaFile = null) {
  
  let API_KEY = "";
  if (typeof CONFIG_API_KEY !== "undefined") {
    API_KEY = CONFIG_API_KEY;
  } else {
    API_KEY = localStorage.getItem("gemini-api-key");
  }

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const parts = [{ text: userMessage }];

  // لو فيه ملف (صورة أو ملف نصي) مبعوث كـ Base64 بنضيفه هنا
  if (mediaFile) {
    parts.push({
      inlineData: {
        mimeType: mediaFile.mimeType,
        data: mediaFile.base64Data
      }
    });
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
        
        // تحويل النجوم لـ Bold وضبط السطور الجديدة
        replyText = replyText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
        
        incomingLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>${replyText}</p>`;

        // حفظ رد البوت جوه الـ Local Storage
        chatHistory.push({ role: "model", text: replyText });
        localStorage.setItem("chat-history", JSON.stringify(chatHistory));

      } else if (data.error) {
        incomingLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>جوجل بيقول: ${data.error.message}</p>`;
      } else {
        incomingLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>فهمتك، بس ياريت توضحي سؤالك أكتر.</p>`;
      }
    })
    .catch((error) => {
      console.error(error);
      incomingLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>عذراً، حصلت مشكلة في الاتصال بالـ API.</p>`;
    })
    .finally(() => chatbox.scrollTo(0, chatbox.scrollHeight));
}

// 2. دالة التحكم في الشات وإنشاء فقاعات الإرسال
const handleChat = () => {
  if (!chatInput) return;
  
  const typedMessage = chatInput.value.trim(); 
  let userMessage = typedMessage; 
  
  if (!userMessage && !pickedMedia) return;
  
  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", "outgoing");
  
  // معالجة عرض الفقاعة بناءً على نوع المرفق
  if (pickedMedia && pickedMedia.mimeType.startsWith("image/")) {
    chatLi.innerHTML = `
      <div class="message-content" style="display: flex; flex-direction: column; gap: 8px;">
        <img src="data:${pickedMedia.mimeType};base64,${pickedMedia.base64Data}" 
             alt="Uploaded Image" 
             style="max-width: 180px; max-height: 180px; border-radius: 12px; object-fit: cover; align-self: flex-end; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
        ${typedMessage ? `<p style="margin: 0; word-break: break-word;">${typedMessage}</p>` : ''}
      </div>
    `;
  } else if (pickedMedia && pickedMedia.mimeType === "text/plain") {
    chatLi.innerHTML = `<p>${typedMessage || "تحليل الملف النصي"} <br><small>📄 تم إرفاق ملف نصي</small></p>`;
    userMessage = typedMessage ? `${typedMessage}\n(برجاء تحليل الملف النصي المرفق)` : "قم بتحليل وتلخيص الملف النصي المرفق.";
  } else {
    chatLi.innerHTML = `<p>${userMessage}</p>`;
  }
  
  chatbox.appendChild(chatLi);

  // حفظ رسالة المستخدم جوه الـ Local Storage
  chatHistory.push({ role: "user", text: chatLi.innerHTML, isHTML: true });
  localStorage.setItem("chat-history", JSON.stringify(chatHistory));

  chatInput.value = ""; 
  chatbox.scrollTo(0, chatbox.scrollHeight);

  // تأثير الكتابة للبوت
  const incomingLi = document.createElement("li");
  incomingLi.classList.add("chat", "incoming");
  incomingLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span>
                          <div class="typing-animation"><span></span><span></span><span></span></div>`;
  chatbox.appendChild(incomingLi);
  chatbox.scrollTo(0, chatbox.scrollHeight);

  // إرسال الطلب مع الـ pickedMedia الموحد
  generateResponse(incomingLi, userMessage, pickedMedia);

  pickedMedia = null;
  if (uploadBtn) uploadBtn.style.color = "#706fd3"; 
  if (fileInput) fileInput.value = "";
};

// دالة استرجاع تاريخ الشات من الـ Local Storage
const loadChatHistory = () => {
  chatbox.innerHTML = ""; // تصفية أي عناصر افتراضية قبل التحميل
  if (chatHistory.length === 0) {
    // لو الـ Local Storage فاضي اعرض رسالة الترحيب الافتراضية
    chatbox.innerHTML = `<li class="chat incoming"><span class="material-symbols-outlined">smart_toy</span><p>Hello! How can I help you today? ✨</p></li>`;
    return;
  }
  chatHistory.forEach(chat => {
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", chat.role === "user" ? "outgoing" : "incoming");
    
    if (chat.role === "user") {
      chatLi.innerHTML = chat.isHTML ? chat.text : `<p>${chat.text}</p>`;
    } else {
      chatLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>${chat.text}</p>`;
    }
    chatbox.appendChild(chatLi);
  });
  chatbox.scrollTo(0, chatbox.scrollHeight);
};

// تشغيل دالة استرجاع التاريخ فوراً عند فتح الملف
loadChatHistory();

// 3. مراقب اختيار الملفات
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0]; 
    if (!file) return; 

    const reader = new FileReader(); 
    
    if (file.type.startsWith("image/")) {
      reader.onload = (e) => {
        const base64Data = e.target.result.split(",")[1];
        pickedMedia = {
          mimeType: file.type,
          base64Data: base64Data
        };
        if (uploadBtn) uploadBtn.style.color = "#2ecc71"; 
        console.log("جاهز لتحليل الصورة!");
      };
      reader.readAsDataURL(file); 

    } else {
      reader.onload = (e) => {
        const base64Data = e.target.result.split(",")[1];
        pickedMedia = {
          mimeType: "text/plain",
          base64Data: base64Data
        };
        if (uploadBtn) uploadBtn.style.color = "#3498db"; 
        console.log("الملف النصي جاهز وتم تحويله لـ Base64 بسرعة!");
      };
      reader.readAsDataURL(file); 
    }
  });
}

// 4. مراقبو الأحداث (Event Listeners) للـ UI
if (sendChatBtn) {
  sendChatBtn.addEventListener("click", handleChat);
}

if (chatToggler) {
  chatToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));
}

if (closeBtn) {
  closeBtn.addEventListener("click", () => document.body.classList.remove("show-chatbot"));
}

if (chatInput) {
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChat();
    }
  });
}

if (fullscreenBtn && chatbotContainer) {
  fullscreenBtn.addEventListener("click", () => {
    chatbotContainer.classList.toggle("fullscreen");
    fullscreenBtn.textContent = chatbotContainer.classList.contains("fullscreen") ? "fullscreen_exit" : "fullscreen";
    setTimeout(() => { if (chatbox) chatbox.scrollTop = chatbox.scrollHeight; }, 100);
  });
}

// ميزة مسح المحادثة بالكامل (Clear Chat)
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    if (confirm("هل أنت متأكد من رغبتك في مسح المحادثة بالكامل؟")) {
      localStorage.removeItem("chat-history");
      chatHistory = [];
      loadChatHistory();
      console.log("تم تنظيف الشات بنجاح!");
    }
  });
}
