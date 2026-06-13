
   
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
let extractedText = null; 

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
      if (sendChatBtn) {
        sendChatBtn.style.pointerEvents = "auto";
        sendChatBtn.style.opacity = "1";
      }
      chatbox.scrollTo(0, chatbox.scrollHeight);
    });
}

// 2. دالة التحكم في الشات
const handleChat = () => {
  if (!chatInput || sendChatBtn.style.pointerEvents === "none") return;
  
  const typedMessage = chatInput.value.trim(); 
  let userMessage = typedMessage; 
  
  if (!userMessage && !pickedMedia && !extractedText) return;
  
  if (sendChatBtn) {
    sendChatBtn.style.pointerEvents = "none";
    sendChatBtn.style.opacity = "0.5";
  }

  // دمج نصوص الـ PDF أو الـ Txt بالتعليمات المزدوجة بنجاح وحمايتها من المسح
  if (extractedText) {
    const systemInstruction = `
[System Instruction / نظام تحليل الملفات الذكي]:
You are an expert document and code analyzer. You support both Arabic and English perfectly.
Analyse the attached file structure, key concepts, or main functions. 
Respond in the same language the user uses for their question. If the user asks "what is the most important part", extract it and explain why based on the actual visible text content.

أنت خبير في تحليل المستندات والأكواد وتدعم العربية والإنجليزية تماماً.
قم بتحليل بنية الملف المرفق، واستخرج الأفكار أو الدوال الأساسية.
رد دائماً بنفس اللغة التي سأل بها المستخدم. إذا سألك عن أهم جزء، استخرجه واشرح السبب بناءً على المحتوى النصي الفعلي المقروء.

[Attached File Content / محتوى الملف المرفق]:
${extractedText}
--------------------------------------------------`;
    userMessage = typedMessage ? `${systemInstruction}\n[User Question]: ${typedMessage}` : `${systemInstruction}\n[User Question]: قم بتحليل هذا الملف بالكامل واستخرج الخلاصة وأهم جزء فيه.`;
  }

  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", "outgoing");
  
  if (pickedMedia && pickedMedia.mimeType.startsWith("image/")) {
    chatLi.innerHTML = `<div class="message-content" style="display: flex; flex-direction: column; gap: 8px;">
        <img src="data:${pickedMedia.mimeType};base64,${pickedMedia.base64Data}" style="max-width: 180px; max-height: 180px; border-radius: 12px; object-fit: cover; align-self: flex-end;">
        ${typedMessage ? `<p style="margin: 0; word-break: break-word;">${typedMessage}</p>` : ''}
      </div>`;
  } else if (extractedText) {
    // تم تصحيح البج هنا: شلنا إعادة حشو الـ userMessage عشان ميمسحش الـ Prompt الذكي فوق
    chatLi.innerHTML = `<p>${typedMessage || "تحليل الملف المرفق"} <br><small>📄 تم إرفاق مستند نصي/PDF</small></p>`;
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

  // نرسل الـ pickedMedia فقط للصور، أما الـ PDF والنصوص فتم دمجها في الـ userMessage خلاص
  const mediaToSend = (pickedMedia && pickedMedia.mimeType.startsWith("image/")) ? pickedMedia : null;
  generateResponse(incomingLi, userMessage, mediaToSend);

  pickedMedia = null;
  extractedText = null;
  if (uploadBtn) uploadBtn.style.color = "#706fd3"; 
  if (fileInput) fileInput.value = "";
};

// 3. مراقب اختيار الملفات الذكي (يستخرج النصوص من الـ PDF الحقيقي محلياً 100% وبدون سيرفر)
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0]; 
    if (!file) return; 

    if (uploadBtn) uploadBtn.style.color = "#a4b0be"; // جاري المعالجة

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
    
    // ب. لو الملف PDF حقيقي (استخراج بشري نقي)
    else if (file.type === "application/pdf") {
      reader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target.result);
          
          // تشغيل المكتبة محلياً بالكامل بدون ملف Worker خارجي
          const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
          let fullText = "";
          
          // اللف على جميع الصفحات لاستخراج النصوص الحقيقية
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // تجميع الكلمات المكتوبة داخل الصفحة
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + "\n";
          }
          
          // تنظيف النص وتأمينه من أي رموز غريبة
          if (fullText.trim().length > 0) {
            extractedText = fullText.substring(0, 9000); // حفظ النص الفعلي
            pickedMedia = null;
            if (uploadBtn) uploadBtn.style.color = "#e67e22"; // برتقالي يعني الـ PDF اشتغل تمام!
            console.log("عاش! تم استخراج النصوص الفعلية من الـ PDF بنجاح.");
          } else {
            // لو الملف عبارة عن صور سكانر مش نصوص
            alert("هذا الملف عبارة عن صور، يرجى رفع صفحاته كصور ليتمكن البوت من قراءتها.");
            if (uploadBtn) uploadBtn.style.color = "#706fd3";
          }
          
        } catch (error) {
          console.error("خطأ أثناء قراءة الـ PDF:", error);
          alert("حدث خطأ أثناء معالجة ملف الـ PDF محلياً.");
          if (uploadBtn) uploadBtn.style.color = "#706fd3";
        }
      };
      reader.readAsArrayBuffer(file); 
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

// الـ Event Listeners الأساسية للـ UI
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
