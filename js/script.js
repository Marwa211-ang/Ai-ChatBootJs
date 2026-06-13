
   
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
// 3. مراقب اختيار الملفات المطور (يدعم الصور، التيكست، والـ PDF الفعلي)
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0]; 
    if (!file) return; 

    // تغيير لون الزرار للإشارة إلى جاري المعالجة (رمادي مثلاً)
    if (uploadBtn) uploadBtn.style.color = "#a4b0be";

    const reader = new FileReader(); 
    
    // أ. لو الملف صورة
    if (file.type.startsWith("image/")) {
      reader.onload = (e) => {
        pickedMedia = { mimeType: file.type, base64Data: e.target.result.split(",")[1] };
        extractedText = null;
        if (uploadBtn) uploadBtn.style.color = "#2ecc71"; // أخضر للصورة
        console.log("جاهز لتحليل الصورة!");
      };
      reader.readAsDataURL(file); 
    } 
    
    // ب. لو الملف PDF حقيقي
    else if (file.type === "application/pdf") {
      reader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target.result);
          // إعداد مكتبة PDF.js
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
          
          const pdf = await pdfjsLib.getDocument(typedarray).promise;
          let fullText = "";
          
          // حلقة وقراءة الصفحات صفحة صفحة وتجميع النصوص
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + "\n";
          }
          
          // حفظ النص المستخرج وقصه لتأمين الكوتة
          extractedText = fullText.substring(0, 10000); 
          pickedMedia = null;
          
          if (uploadBtn) uploadBtn.style.color = "#e67e22"; // برتقالي للـ PDF
          console.log("تم استخراج النصوص من الـ PDF بنجاح!");
        } catch (error) {
          console.error("خطأ في قراءة الـ PDF:", error);
          alert("فشل في استخراج النصوص من ملف الـ PDF");
          if (uploadBtn) uploadBtn.style.color = "#706fd3";
        }
      };
      reader.readAsArrayBuffer(file); // قراءة الـ PDF كـ ArrayBuffer للمكتبة
    } 
    
    // ج. لو الملف نصي عادي (.txt, .js, .css...)
    else {
      reader.onload = (e) => {
        extractedText = e.target.result.substring(0, 8000); 
        pickedMedia = null;
        if (uploadBtn) uploadBtn.style.color = "#3498db"; // أزرق للتيكست
        console.log("الملف النصي جاهز تماماً!");
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
