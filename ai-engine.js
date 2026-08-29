// ==========================================================================
// XHAODIN AI v2.0 - Human-Like Intelligent Response Engine
// All strings use single quotes + concatenation to avoid template literal issues
// ==========================================================================

class XhaodinAI {
  constructor() {
    this.history = new Map();
  }

  getHistory(uid) {
    if (!this.history.has(uid)) this.history.set(uid, []);
    return this.history.get(uid);
  }

  addToHistory(uid, role, content) {
    var h = this.getHistory(uid);
    h.push({ role: role, content: content, ts: Date.now() });
    if (h.length > 15) h.shift();
  }

  respond(uid, message) {
    var msg = message.trim();
    var lower = msg.toLowerCase();
    this.addToHistory(uid, 'user', msg);
    var response = '';

    if (/^(hi|hello|hey|yo|hola|salam|assalam|slm|sup|what'?s up|kya haal|kaise|kaisa)/i.test(lower)) {
      response = this.greet(lower, uid);
    } else if (/how (are|r) (you|u)|kya (haal|chal)|kaisa hai|kaise ho/i.test(lower)) {
      response = this.howAreYou();
    } else if (/who (are|r) (you|u)|tumh?ara naam|your name|tu kaun|kya hai tu/i.test(lower)) {
      response = this.identity();
    } else if (/what can you|kya kar|what do you|tum kya|capabilities|help me/i.test(lower)) {
      response = this.capabilities();
    } else if (/\b(time|waqt|kitne baje|what time|current time)\b/i.test(lower) && !/\b(code|coding|program)\b/i.test(lower)) {
      response = this.tellTime();
    } else if (/\b(date|aaj|din|tarikh|what date|today|what day)\b/i.test(lower)) {
      response = this.tellDate();
    } else if (/\b(joke|jokes|hasao|mazaak|mazak|funny|laugh|hasi|comedy|make me laugh)\b/i.test(lower)) {
      response = this.tellJoke();
    } else if (this.isMath(lower, msg)) {
      response = this.doMath(msg);
    } else if (this.isCodeQuestion(lower)) {
      response = this.answerCode(lower, msg);
    } else if (/\b(what is|what are|who is|who was|define|explain|tell me about|batao|samjhao|kya hota hai|kya hai)\b/i.test(lower)) {
      response = this.answerKnowledge(lower, msg);
    } else if (/\b(how to|how do|how can|kaise|kaise kare|kaise hota)\b/i.test(lower)) {
      response = this.answerHowTo(lower, msg);
    } else if (/\b(thanks?|thank u|shukriya|dhanyavaad|thx|ty)\b/i.test(lower)) {
      response = this.thankYou();
    } else if (/\b(weather|mausam|temperature|tapman|garmi|sardi|barish)\b/i.test(lower)) {
      response = this.weather(lower);
    } else if (/\b(fact| facts|did you know|kya pata|interesting|trivia|some fact)\b/i.test(lower)) {
      response = this.randomFact();
    } else if (/\b(motivat|inspir|quotes?|quote|life quote|motivat.*me|inspir.*me)\b/i.test(lower)) {
      response = this.motivation();
    } else if (/\b(meaning of life|purpose|philosophy|why we|why do we|kya zindagi)\b/i.test(lower)) {
      response = this.philosophical();
    } else if (/\b(xhaodin|site|app|website|platform)\b/i.test(lower)) {
      response = this.aboutXhaodin();
    } else {
      response = this.smartFallback(msg, lower);
    }

    this.addToHistory(uid, 'assistant', response);
    return response;
  }

  greet(msg, uid) {
    var hour = new Date().getHours();
    var h = this.getHistory(uid);
    var hasGreeted = h.some(function(m) { return m.role === 'user' && /^(hi|hello|hey|yo)/i.test(m.content); });
    var timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Hey there';

    if (hasGreeted && h.length > 2) {
      var casuals = [
        'Hey again! \u{1F60A} What\'s on your mind?',
        'Hey! Still here to help. What do you need?',
        'Hello again! How can I assist you this time?',
        'Hi there! Ready for your next question! \u{1F680}'
      ];
      return casuals[Math.floor(Math.random() * casuals.length)];
    }

    if (/salam|assalam|slm/i.test(msg)) {
      return 'Wa Alaikum Assalam! \u{1F319} Hope you\'re doing great. I\'m XHAODIN AI \u2014 your intelligent assistant. Ask me anything \u2014 coding, math, general knowledge, or just have a conversation! How can I help?';
    }

    if (/kya haal|kaise|kaisa/i.test(msg)) {
      return 'Sab badhiya hai! \u{1F60A} Main hoon XHAODIN AI \u2014 tumhara intelligent assistant. Batao kya help chahiye? Coding, math, general knowledge, jokes \u2014 kuch bhi pooch sakte ho!';
    }

    return timeGreeting + '! \u{1F44B} I\'m XHAODIN AI, your personal intelligent assistant. Whether you need help with coding, want to solve math problems, learn something new, or just chat \u2014 I\'m here for you. What can I help with today?';
  }

  howAreYou() {
    var responses = [
      'I\'m doing amazing, thanks for asking! \u{1F680} All systems running at peak performance. I\'m ready to tackle whatever question you throw at me. How about you? What\'s on your mind today?',
      'Doing great! \u{1F60A} Running on full power and ready to help. Think of me as your personal assistant \u2014 I can help with coding, math, knowledge, or just have a fun conversation. What would you like to explore?',
      'I\'m fantastic! Every question makes me sharper. \u{1F4A1} I\'ve got knowledge spanning programming, science, math, and more. So \u2014 what are we working on today?'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  identity() {
    return 'I\'m **XHAODIN AI** \u2014 a built-in intelligent assistant created for the XHAODIN Messenger platform. \u{1F916}\n\nI\'m designed to be your all-in-one helper:\n\n\u2022 \u{1F4BB} **Coding Expert** \u2014 JavaScript, Python, React, Node.js, HTML/CSS, and more\n\u2022 \u{1F9EE} **Math Solver** \u2014 From basic arithmetic to complex expressions\n\u2022 \u{1F4DA} **Knowledge Hub** \u2014 Science, technology, history, geography\n\u2022 \u{1F602} **Entertainment** \u2014 Jokes, fun facts, interesting trivia\n\u2022 \u23F0 **Live Info** \u2014 Current time, date, and more\n\nI work both online and offline. Think of me as your personal Gemini, right inside your messenger. What shall we dive into?';
  }

  capabilities() {
    return 'Here\'s everything I can do for you:\n\n\u{1F4BB} **Programming Help**\n\u2022 Explain concepts (closures, promises, async/await, etc.)\n\u2022 Write code in JavaScript, Python, React, Node.js, HTML/CSS\n\u2022 Debug issues and suggest solutions\n\n\u{1F9EE} **Math & Calculations**\n\u2022 "What is 256 * 345?"\n\u2022 "Calculate sqrt of 144"\n\u2022 "What is 15% of 850?"\n\n\u{1F4DA} **General Knowledge**\n\u2022 Ask about any topic \u2014 science, tech, history\n\u2022 "What is machine learning?"\n\u2022 "Explain quantum computing"\n\n\u{1F602} **Fun & Entertainment**\n\u2022 "Tell me a joke"\n\u2022 "Give me a fun fact"\n\n\u23F0 **Live Information**\n\u2022 Current time and date\n\nJust type your question naturally and I\'ll give you a clear, detailed answer! \u{1F680}';
  }

  tellTime() {
    var now = new Date();
    var time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    return 'The current time is **' + time + '** (' + tz + '). \u23F0\n\nIs there anything specific you need help with? Maybe scheduling something, or just curious about the time?';
  }

  tellDate() {
    var now = new Date();
    var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    var date = now.toLocaleDateString('en-US', options);
    var dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    var weeksLeft = Math.floor((365 - dayOfYear) / 7);
    return 'Today is **' + date + '**. \u{1F4C5}\n\nThat\'s day ' + dayOfYear + ' of ' + now.getFullYear() + ' \u2014 ' + weeksLeft + ' weeks left in the year. Hope you\'re making the most of it! Anything I can help with?';
  }

  tellJoke() {
    var jokes = [
      'Why do programmers prefer dark mode?\n\nBecause light attracts bugs! \u{1F41B}\u{1F604}',
      'A SQL query walks into a bar, sees two tables, and asks:\n\n"Can I join you?" \u{1F37A}',
      'Why do Java developers wear glasses?\n\nBecause they can\'t C#! \u{1F576}\uFE0F',
      'There are only 10 types of people in the world:\n\nThose who understand binary, and those who don\'t. \u{1F913}',
      'Why was the JavaScript developer sad?\n\nBecause he didn\'t Node how to Express himself. \u{1F622}\n\n...but don\'t worry, I\'m here to help you express your ideas! \u{1F604}',
      'What\'s a programmer\'s favorite hangout place?\n\nFoo Bar! \u{1F37B}',
      'Why do programmers hate nature?\n\nIt has too many bugs! \u{1F41E}',
      'How many programmers does it take to change a light bulb?\n\nNone \u2014 that\'s a hardware problem! \u{1F4A1}',
      'Parallel lines have so much in common...\n\nIt\'s a shame they\'ll never meet. \u{1F4D0}',
      'I\'m reading a book about anti-gravity.\n\nIt\'s impossible to put down! \u{1F4DA}',
      'Why don\'t scientists trust atoms?\n\nBecause they make up everything! \u269B\uFE0F',
      'What do you call a fake noodle?\n\nAn impasta! \u{1F35D}'
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }

  randomFact() {
    var facts = [
      'Here\'s a mind-blowing fact \u{1F9E0}\n\n**Honey never spoils.** Archaeologists found 3,000-year-old honey in Egyptian tombs that was still perfectly edible. The low moisture content and acidic pH create an environment where bacteria simply can\'t survive.',
      'Did you know? \u{1F30D}\n\n**There are more trees on Earth than stars in the Milky Way galaxy.** Earth has about 3 trillion trees, while the Milky Way has an estimated 100-400 billion stars. Nature wins!',
      'Fun fact for you \u{1F99E}\n\n**Octopuses have three hearts and blue blood.** Two hearts pump blood to the gills, while the third pumps it to the rest of the body. Their blood is blue because it uses copper-based hemocyanin instead of iron-based hemoglobin.',
      'Here\'s something wild \u{1FA90}\n\n**A day on Venus is longer than a year on Venus.** Venus takes 243 Earth days to rotate once but only 225 Earth days to orbit the Sun. Plus, it spins backwards compared to most planets!',
      'Mind = Blown \u{1F92F}\n\n**Bananas are technically berries, but strawberries are not.** In botanical terms, a berry comes from a single flower with one ovary. Bananas qualify, but strawberries don\'t because they have seeds on the outside.',
      'Here\'s a cool one \u{1F3B5}\n\n**The human brain can process music as quickly as 10-15 milliseconds.** That\'s faster than any other auditory stimulus. Music literally speaks to your brain on a deeper level than words.',
      'Wild fact \u{1F3DB}\uFE0F\n\n**Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.** The pyramid was built around 2560 BC, Cleopatra lived around 30 BC, and the Moon landing was 1969 AD.'
    ];
    return facts[Math.floor(Math.random() * facts.length)];
  }

  motivation() {
    var quotes = [
      '"The only way to do great work is to love what you do." \u2014 Steve Jobs\n\nRemember: Every expert was once a beginner. Keep going! \u{1F4AA}',
      '"It does not matter how slowly you go as long as you do not stop." \u2014 Confucius\n\nProgress is progress, no matter how small. You\'re doing better than you think! \u{1F31F}',
      '"Success is not final, failure is not fatal: it is the courage to continue that counts." \u2014 Winston Churchill\n\nEvery setback is a setup for a comeback. Keep pushing! \u{1F680}',
      '"The best time to plant a tree was 20 years ago. The second best time is now." \u2014 Chinese Proverb\n\nIt\'s never too late to start something amazing. What are you waiting for? \u{1F333}',
      '"In the middle of every difficulty lies opportunity." \u2014 Albert Einstein\n\nChallenges are just hidden chances to grow stronger. You\'ve got this! \u{1F4A1}'
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  philosophical() {
    return 'That\'s a deep question! \u{1F30C}\n\nThe meaning of life is one of humanity\'s oldest questions. Here are some perspectives:\n\n**Science says:** We\'re here because of billions of years of evolution \u2014 the universe arranged atoms in just the right way for consciousness to emerge.\n\n**Philosophy says:** Life\'s meaning is what you create. Existentialists like Sartre argued we\'re "condemned to be free" \u2014 we must define our own purpose.\n\n**Technology says:** Every line of code you write, every problem you solve, every connection you make \u2014 that\'s meaning in action.\n\n**My take as an AI:** Purpose isn\'t something you find \u2014 it\'s something you build, one day at a time. The fact that you\'re asking this question means you\'re already on the right path. \u{1F31F}\n\nWhat gives YOUR life meaning? I\'d love to hear your perspective!';
  }

  aboutXhaodin() {
    return '**XHAODIN Messenger** is a premium, secure communication platform built with cutting-edge technology. \u{1F6E1}\uFE0F\n\nHere\'s what makes it special:\n\n\u2022 \u{1F510} **End-to-end encrypted messaging** \u2014 your conversations stay private\n\u2022 \u{1F4DE} **HD Voice & Video Calls** \u2014 powered by WebRTC technology\n\u2022 \u{1F916} **AI Assistant** \u2014 that\'s me! Built right into the messenger\n\u2022 \u{1F465} **Group Chats** \u2014 with admin controls and moderation\n\u2022 \u{1F4F8} **Status Stories** \u2014 share moments with your contacts\n\u2022 \u{1F3A8} **Premium Cyber UI** \u2014 sleek, modern design with customizable themes\n\u2022 \u{1F4F1} **Responsive Design** \u2014 works beautifully on desktop and mobile\n\nThe platform supports real-time messaging, call history tracking, admin approval systems, and now \u2014 an intelligent AI assistant (me!) to help with anything you need.\n\nBuilt with Node.js, WebSockets, WebRTC, and vanilla JavaScript with Tailwind CSS. No frameworks \u2014 pure engineering! \u{1F4AA}';
  }

  weather(lower) {
    return 'I\'d love to give you real-time weather data! \u{1F324}\uFE0F\n\nCurrently, my web data collector fetches weather information when connected to the internet. The data gets cached on the server so I can reference it later.\n\nFor now, here are some weather facts:\n\u2022 The hottest temperature ever recorded was 134\u00B0F (56.7\u00B0C) in Death Valley, 1913\n\u2022 The coldest was -128.6\u00B0F (-89.2\u00B0C) at Antarctica\'s Vostok Station\n\u2022 Rain drops can fall at speeds of 14 mph\n\u2022 No two snowflakes are exactly alike\n\nFor live weather, try checking a weather service in your area! \u{1F30D}';
  }

  // ===== MATH ENGINE =====

  isMath(lower, msg) {
    return (/\b(calculate|solve|what is|compute|how much|kitna|evaluate)\b/i.test(lower) && /[\d\+\-\*\/\%\(\)]/.test(msg)) ||
      (/^\s*[\d\.\(]/.test(msg) && /[\+\-\*\/\%]/.test(msg)) ||
      /\b(square root|sqrt|factorial|power|percentage)\b/i.test(lower);
  }

  doMath(msg) {
    var lower = msg.toLowerCase();
    try {
      var sqrtMatch = lower.match(/sqrt(?:\s*(?:of|for)?)?\s*(\d+[\.\d]*)/i) || lower.match(/square\s*root\s*(?:of)?\s*(\d+[\.\d]*)/i);
      if (sqrtMatch) {
        var n = parseFloat(sqrtMatch[1]);
        if (n < 0) return 'I can\'t calculate the square root of a negative number in real numbers. \u{1F914}\n\nBut in complex numbers, \u221A' + n + ' = ' + Math.sqrt(Math.abs(n)).toFixed(4) + 'i\n\nWant me to explain complex numbers?';
        return '**\u221A' + n + '** = **' + Math.sqrt(n).toFixed(4).replace(/\.?0+$/, '') + '**\n\nThe square root of ' + n + ' is approximately **' + Math.sqrt(n).toFixed(2) + '**. Math is beautiful in its precision! \u{1F9EE}';
      }

      var factMatch = lower.match(/(\d+)\s*!/i) || lower.match(/factorial\s*(?:of)?\s*(\d+)/i);
      if (factMatch) {
        var fn = parseInt(factMatch[1]);
        if (fn > 170) return 'Whoa, ' + fn + '! is an astronomically large number \u2014 bigger than what can be represented precisely. \u{1F92F}\n\nFor reference, 170! \u2248 7.26 \u00D7 10^306. That\'s more than the number of atoms in the observable universe!';
        if (fn < 0) return 'Factorial is not defined for negative numbers. \u{1F914}';
        var fResult = 1;
        for (var i = 2; i <= fn; i++) fResult *= i;
        return '**' + fn + '!** = **' + fResult.toLocaleString() + '**\n\nFun fact: ' + fn + '! means multiplying all numbers from 1 to ' + fn + '. ' + (fn > 5 ? 'That\'s ' + fResult.toString().length + ' digits of pure multiplication power!' : 'A nice clean result!') + ' \u{1F9EE}';
      }

      var pctMatch = lower.match(/(\d+[\.\d]*)\s*%\s*(?:of)?\s*(\d+[\.\d]*)/i) || lower.match(/(?:what is|calculate)\s*(\d+[\.\d]*)\s*percent\s*(?:of)?\s*(\d+[\.\d]*)/i);
      if (pctMatch) {
        var pct = parseFloat(pctMatch[1]);
        var pval = parseFloat(pctMatch[2]);
        var pResult = (pval * pct / 100);
        return '**' + pct + '% of ' + pval + '** = **' + pResult + '**\n\nCalculation: ' + pval + ' \u00D7 ' + pct + ' / 100 = ' + pResult + ' \u{1F9EE}';
      }

      var expr = msg.replace(/what is/gi, '').replace(/calculate/gi, '').replace(/solve/gi, '').replace(/compute/gi, '').replace(/how much is/gi, '').replace(/\?/g, '').trim();
      expr = expr.replace(/\^/g, '**');
      if (/^[\d\.\s\+\-\*\/\%\(\)\*]+$/.test(expr)) {
        var eResult = Function('"use strict"; return (' + expr + ')')();
        if (typeof eResult === 'number' && isFinite(eResult)) {
          return '**' + msg.replace(/what is/gi, '').replace(/calculate/gi, '').trim() + '** = **' + (Number.isInteger(eResult) ? eResult.toLocaleString() : eResult.toFixed(4).replace(/\.?0+$/, '')) + '**\n\nMath checked, math delivered! \u{1F9EE}\u2728';
        }
      }

      var nums = msg.match(/\d+[\.\d]*/g);
      if (nums && nums.length >= 2) {
        var a = parseFloat(nums[0]);
        var b = parseFloat(nums[1]);
        if (/\+|plus|add/i.test(lower)) return '**' + a + ' + ' + b + '** = **' + (a + b) + '** \u{1F9EE}';
        if (/\-|minus|subtract|less/i.test(lower)) return '**' + a + ' - ' + b + '** = **' + (a - b) + '** \u{1F9EE}';
        if (/\*|times|multiply|x|\u00D7/i.test(lower)) return '**' + a + ' \u00D7 ' + b + '** = **' + (a * b) + '** \u{1F9EE}';
        if (/\bdivided|divide|div\b/i.test(lower)) {
          if (b === 0) return 'I can\'t divide by zero \u2014 that\'s mathematically undefined! \u{1F6AB}';
          return '**' + a + ' \u00F7 ' + b + '** = **' + (a / b).toFixed(4).replace(/\.?0+$/, '') + '** \u{1F9EE}';
        }
      }

      return 'I see you\'re trying to solve something mathematical! \u{1F9EE}\n\nCould you rephrase it a bit? For example:\n\u2022 "What is 256 * 345?"\n\u2022 "Calculate sqrt of 144"\n\u2022 "What is 15% of 850?"\n\u2022 "2 + 2"\n\nI\'ll give you a precise answer!';
    } catch (e) {
      return 'Hmm, I couldn\'t parse that math expression. \u{1F914}\n\nTry something like:\n\u2022 "What is 256 * 345?"\n\u2022 "Calculate 144 / 12"\n\u2022 "sqrt of 256"\n\u2022 "15% of 800"\n\nI\'ll crunch the numbers for you!';
    }
  }

  // ===== CODE ENGINE =====

  isCodeQuestion(lower) {
    return /\b(code|coding|function|programming|developer|software|bug|debug|syntax|variable|loop|array|object|class|module|import|export|npm|pip|git|docker|api|database|sql|html|css|javascript|python|react|node|typescript|java|ruby|php|swift|kotlin|rust|golang|closure|promise|async|await|hook|state|component|render|dom|event|callback|fetch|http|rest|json|jwt|cors|websocket|algorithm|data structure|sort|search|binary|tree|linked list|stack|queue)\b/i.test(lower);
  }

  answerCode(lower, msg) {
    // JavaScript
    if (/javascript|js\b/i.test(lower)) {
      if (/closure/i.test(lower)) {
        return '**Closures** are one of JavaScript\'s most powerful features.\n\nA closure is a function that remembers the variables from its outer scope, even after the outer function has finished executing.\n\n```javascript\nfunction createCounter() {\n  let count = 0;\n  return {\n    increment: () => ++count,\n    getCount: () => count\n  };\n}\n\nconst counter = createCounter();\ncounter.increment();\ncounter.increment();\nconsole.log(counter.getCount()); // 2\n```\n\n**Why are closures useful?**\n\u2022 Data privacy (encapsulation)\n\u2022 Factory functions\n\u2022 Event handlers with state\n\u2022 Memoization and caching\n\u2022 Partial application\n\nThink of it like a backpack \u{1F392} \u2014 the function carries its "environment" wherever it goes.';
      }
      if (/promise/i.test(lower)) {
        return '**Promises** handle asynchronous operations elegantly.\n\nA Promise represents a value that may not be available yet \u2014 like placing an order at a restaurant. You get a receipt (the Promise), and your food (the result) comes later.\n\n```javascript\nconst fetchData = () => {\n  return new Promise((resolve, reject) => {\n    setTimeout(() => {\n      resolve({ name: "Ali", age: 25 });\n    }, 1000);\n  });\n};\n\n// Using .then/.catch\nfetchData()\n  .then(data => console.log(data))\n  .catch(err => console.error(err));\n\n// Using async/await (modern way)\nconst data = await fetchData();\n```\n\n**Three states:** Pending \u2192 Fulfilled (\u2705) or Rejected (\u274C)\n\nAlways handle rejections with .catch() or try/catch!';
      }
      if (/async|await/i.test(lower)) {
        return 'async/await makes asynchronous code look and feel synchronous.\n\n```javascript\nasync function getUserProfile(userId) {\n  try {\n    const response = await fetch("/api/users/" + userId);\n    if (!response.ok) {\n      throw new Error("HTTP " + response.status);\n    }\n    const user = await response.json();\n    return user;\n  } catch (error) {\n    console.error("Failed to fetch user:", error);\n    throw error;\n  }\n}\n```\n\n**Key rules:**\n\u2022 async before function \u2192 function always returns a Promise\n\u2022 await before a Promise \u2192 waits for it to resolve\n\u2022 Only use await inside async functions\n\n**Common mistake:** Forgetting to handle errors. Always use try/catch!';
      }
      return 'Great question about JavaScript! \u{1F7E1}\n\nJavaScript is the language of the web \u2014 versatile, powerful, and everywhere.\n\n**Core Concepts:**\n\u2022 Variables: let, const, var\n\u2022 Functions: arrow functions, higher-order functions\n\u2022 Objects & Arrays: destructuring, spread operator\n\u2022 Closures: functions that remember their scope\n\n**Modern JS (ES6+):**\n\u2022 Template literals\n\u2022 Destructuring\n\u2022 Modules: import/export\n\u2022 Optional chaining: user?.address?.city\n\n**Asynchronous:**\n\u2022 Callbacks \u2192 Promises \u2192 async/await\n\u2022 Event loop, microtasks, macrotasks\n\nAsk me about any specific topic and I\'ll dive deep! \u{1F680}';
    }

    // Python
    if (/python/i.test(lower)) {
      if (/list comprehension/i.test(lower)) {
        return '**List Comprehensions** are Python\'s most elegant feature.\n\nThey create lists in a single, readable line:\n\n```python\n# Basic\nsquares = [x**2 for x in range(10)]\n# [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]\n\n# With condition\nevens = [x for x in range(20) if x % 2 == 0]\n\n# Nested\nmatrix = [[i*j for j in range(3)] for i in range(3)]\n\n# With function\nwords = ["hello", "world", "python"]\nupper = [w.upper() for w in words]\n```\n\n**Why use them?**\n\u2022 Faster than regular loops\n\u2022 More readable\n\u2022 Pythonic code style\n\u2022 One-liner elegance';
      }
      return 'Python is an amazing language! \u{1F40D}\n\n**Why developers love Python:**\n\u2022 Clean, readable syntax (almost like English)\n\u2022 Massive ecosystem (Django, Flask, NumPy, pandas)\n\u2022 Great for: web dev, data science, AI/ML, automation\n\n**Key Features:**\n```python\n# List comprehension\nsquares = [x**2 for x in range(10)]\n\n# Lambda functions\nadd = lambda a, b: a + b\n\n# f-strings\nname = "Ali"\nprint(f"Hello, {name}!")\n\n# Dictionary\nuser = {"name": "Ali", "age": 25}\n```\n\nWhat specific Python topic would you like to explore?';
    }

    // React
    if (/react/i.test(lower)) {
      if (/hook|state|usestate/i.test(lower)) {
        return '**React Hooks** let you use state and lifecycle in functional components.\n\n```jsx\nimport { useState, useEffect } from "react";\n\nfunction UserProfile({ userId }) {\n  const [user, setUser] = useState(null);\n  const [loading, setLoading] = useState(true);\n\n  useEffect(() => {\n    fetch("/api/users/" + userId)\n      .then(res => res.json())\n      .then(data => {\n        setUser(data);\n        setLoading(false);\n      });\n  }, [userId]);\n\n  if (loading) return <Spinner />;\n\n  return (\n    <div>\n      <h2>{user.name}</h2>\n      <p>{user.email}</p>\n    </div>\n  );\n}\n```\n\n**Hook Rules:**\n1. Only call hooks at the top level\n2. Only call hooks in React functions\n3. Custom hooks start with "use"';
      }
      return 'React is the most popular UI library! \u269B\uFE0F\n\n**Key Concepts:**\n\u2022 **Components:** Building blocks of UI\n\u2022 **JSX:** HTML-like syntax in JavaScript\n\u2022 **Props:** Data passed from parent to child\n\u2022 **State:** Internal component data\n\u2022 **Hooks:** useState, useEffect, useContext\n\n```jsx\nfunction App() {\n  const [count, setCount] = useState(0);\n  return (\n    <button onClick={() => setCount(c => c + 1)}>\n      Count: {count}\n    </button>\n  );\n}\n```\n\nWant me to explain any specific React concept?';
    }

    // Node.js / Express
    if (/node|express/i.test(lower)) {
      return '**Node.js + Express** \u2014 the backbone of modern backend development.\n\n```javascript\nconst express = require("express");\nconst cors = require("cors");\nconst app = express();\n\napp.use(cors());\napp.use(express.json());\n\n// GET endpoint\napp.get("/api/users", async (req, res) => {\n  const users = await db.getUsers();\n  res.json(users);\n});\n\n// POST endpoint\napp.post("/api/users", async (req, res) => {\n  const user = await db.createUser(req.body);\n  res.status(201).json(user);\n});\n\n// Error handling middleware\napp.use((err, req, res, next) => {\n  console.error(err.stack);\n  res.status(500).json({ error: "Something went wrong!" });\n});\n\napp.listen(4000, () => console.log("Server running"));\n```\n\n**Essential packages:** express, cors, dotenv, mongoose, jsonwebtoken, bcrypt';
    }

    // HTML / CSS
    if (/html|css/i.test(lower)) {
      return '**HTML + CSS** \u2014 the foundation of every web page.\n\n**HTML5 Semantic Structure:**\n```html\n<header>Site header</header>\n<nav>Navigation</nav>\n<main>\n  <article>Content</article>\n  <aside>Sidebar</aside>\n</main>\n<footer>Footer</footer>\n```\n\n**CSS Flexbox (most useful):**\n```css\n.container {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 1rem;\n}\n```\n\n**CSS Grid (2D layouts):**\n```css\n.grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 1rem;\n}\n```\n\nModern CSS also includes: variables, calc(), clamp(), container queries!';
    }

    // Git
    if (/\bgit\b|github/i.test(lower)) {
      return '**Git** \u2014 version control that every developer needs.\n\n**Essential Commands:**\n```bash\n# Setup\ngit config --global user.name "Your Name"\ngit config --global user.email "email@example.com"\n\n# Daily workflow\ngit add .\ngit commit -m "message"\ngit push origin main\ngit pull\n\n# Branching\ngit checkout -b feature\ngit merge feature\ngit branch -d feature\n\n# Undo mistakes\ngit reset --soft HEAD~1\ngit stash / git stash pop\ngit diff\n```\n\n**Pro tip:** Write clear commit messages. "Fix login bug" > "asdf" \u{1F604}';
    }

    // API / REST
    if (/\bapi\b|rest|http/i.test(lower)) {
      return '**REST API** \u2014 the standard for web communication.\n\n**HTTP Methods:**\n```\nGET    /api/users      \u2192 Read all users\nGET    /api/users/1    \u2192 Read one user\nPOST   /api/users      \u2192 Create user\nPUT    /api/users/1    \u2192 Update user\nDELETE /api/users/1    \u2192 Delete user\n```\n\n**Status Codes:**\n\u2705 200 OK | 201 Created | 204 No Content\n\U0001F504 301 Redirect | 304 Not Modified\n\u274C 400 Bad Request | 401 Unauthorized | 403 Forbidden | 404 Not Found\n\U0001F4A5 500 Server Error\n\n**REST Principles:**\n\u2022 Stateless \u2014 each request is independent\n\u2022 Resource-based URLs\n\u2022 Standard HTTP methods\n\u2022 JSON for data format';
    }

    // Default code fallback
    return 'Great coding question! \u{1F4BB}\n\nI can help with these programming topics:\n\n**JavaScript:** closures, promises, async/await, ES6+, DOM, events\n**Python:** list comprehension, classes, file handling, pip\n**React:** hooks, state, components, JSX\n**Node.js:** Express, APIs, middleware\n**HTML/CSS:** flexbox, grid, responsive design\n**Git:** commands, branching, collaboration\n**APIs:** REST, HTTP, JSON, JWT, CORS\n\nTry asking something specific like:\n\u2022 "What is a closure in JavaScript?"\n\u2022 "How do I create a React component?"\n\u2022 "Explain async await"\n\nI\'ll give you detailed code examples! \u{1F680}';
  }

  // ===== KNOWLEDGE ENGINE =====

  answerKnowledge(lower, msg) {
    if (/javascript/i.test(lower)) {
      return '**JavaScript** is a high-level, interpreted programming language primarily used for web development.\n\n**Key Features:**\n\u2022 Event-driven & asynchronous\n\u2022 First-class functions\n\u2022 Prototypal inheritance\n\u2022 Dynamic typing\n\u2022 Single-threaded with event loop\n\n**Use Cases:**\n\u2022 Frontend: React, Vue, Angular\n\u2022 Backend: Node.js\n\u2022 Mobile: React Native\n\u2022 Desktop: Electron\n\nJavaScript is the most popular programming language in the world, used by 97% of websites.';
    }
    if (/python/i.test(lower)) {
      return '**Python** is a high-level, general-purpose programming language known for its clean syntax.\n\n**Why Python?**\n\u2022 Reads like English\n\u2022 Massive library ecosystem\n\u2022 Great for beginners AND professionals\n\n**Use Cases:**\n\u2022 Web Development: Django, Flask\n\u2022 Data Science: NumPy, pandas, Matplotlib\n\u2022 AI/ML: TensorFlow, PyTorch\n\u2022 Automation & Scripting\n\nPython consistently ranks #1 in popularity surveys.';
    }
    if (/react/i.test(lower)) {
      return '**React** is a JavaScript library for building user interfaces, created by Meta.\n\n**Core Concepts:**\n\u2022 Component-based architecture\n\u2022 Virtual DOM for performance\n\u2022 One-way data flow\n\u2022 JSX syntax\n\u2022 Hooks for state & side effects\n\nReact powers millions of apps including Instagram, Netflix, Airbnb, and WhatsApp Web.';
    }
    if (/\bnode/i.test(lower)) {
      return '**Node.js** is a JavaScript runtime built on Chrome\'s V8 engine.\n\n**Key Features:**\n\u2022 Event-driven, non-blocking I/O\n\u2022 npm (largest package ecosystem)\n\u2022 Single-threaded event loop\n\u2022 Perfect for real-time apps\n\n**Used for:** APIs, real-time chat, streaming, microservices.';
    }
    if (/html/i.test(lower)) {
      return '**HTML (HyperText Markup Language)** is the standard markup for web pages.\n\nHTML5 introduced:\n\u2022 Semantic tags: header, nav, main\n\u2022 Canvas for graphics\n\u2022 Video/Audio elements\n\u2022 Forms & validation\n\u2022 localStorage/sessionStorage\n\nHTML is the skeleton of every web page.';
    }
    if (/\bcss\b/i.test(lower)) {
      return '**CSS (Cascading Style Sheets)** controls the visual presentation of HTML.\n\n**Modern CSS Features:**\n\u2022 Flexbox & Grid layouts\n\u2022 CSS Variables (custom properties)\n\u2022 Animations & transitions\n\u2022 Media queries for responsiveness\n\u2022 Container queries\n\nCSS makes the web beautiful!';
    }
    if (/\bapi\b/i.test(lower)) {
      return 'An **API (Application Programming Interface)** is a set of rules for software communication.\n\n**Types:**\n\u2022 REST: HTTP methods (GET, POST, PUT, DELETE)\n\u2022 GraphQL: Flexible query language\n\u2022 WebSocket: Real-time bidirectional\n\u2022 gRPC: High-performance RPC\n\nAPIs are the backbone of modern software.';
    }
    if (/database|sql/i.test(lower)) {
      return 'A **database** is an organized collection of structured data.\n\n**Types:**\n\u2022 **Relational (SQL):** MySQL, PostgreSQL, SQLite\n  \u2014 Structured tables with schemas\n  \u2014 ACID compliance\n  \u2014 SQL queries\n\n\u2022 **NoSQL:** MongoDB, Redis, Firebase\n  \u2014 Flexible schemas\n  \u2014 Horizontal scaling\n  \u2014 Various data models\n\n**When to use what?** SQL for complex relationships, NoSQL for flexibility and scale.';
    }
    if (/\bgit\b/i.test(lower)) {
      return '**Git** is a distributed version control system for tracking code changes.\n\n**Why Git?**\n\u2022 Track every change to your code\n\u2022 Branch & merge workflows\n\u2022 Collaborate with teams\n\u2022 Roll back mistakes\n\nGit was created by Linus Torvalds (the same person who created Linux) in 2005.';
    }
    if (/docker/i.test(lower)) {
      return '**Docker** is a platform for building and running applications in containers.\n\n**What are containers?** Lightweight, isolated environments that package your app + dependencies.\n\n**Benefits:**\n\u2022 "Works on my machine" problem solved\n\u2022 Consistent across environments\n\u2022 Easy scaling\n\u2022 Resource efficient\n\n**Dockerfile example:**\n```dockerfile\nFROM node:18\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nEXPOSE 3000\nCMD ["node", "server.js"]\n```';
    }
    if (/machine learning|artificial intelligence|\bai\b/i.test(lower)) {
      return '**Machine Learning** is a subset of AI where systems learn from data.\n\n**Types:**\n\u2022 Supervised: labeled data (classification, regression)\n\u2022 Unsupervised: finding patterns (clustering)\n\u2022 Reinforcement: learning from rewards\n\n**Popular Frameworks:**\n\u2022 TensorFlow / Keras\n\u2022 PyTorch\n\u2022 Scikit-learn\n\n**Applications:**\nImage recognition, natural language processing, recommendation systems, self-driving cars.';
    }
    if (/blockchain/i.test(lower)) {
      return '**Blockchain** is a distributed, immutable digital ledger.\n\n**How it works:**\n1. Transaction requested\n2. Block created with transaction data\n3. Block broadcast to network\n4. Network validates the block\n5. Block added to chain\n\n**Key properties:**\n\u2022 Decentralized \u2014 no single point of control\n\u2022 Immutable \u2014 can\'t be altered once confirmed\n\u2022 Transparent \u2014 visible to all participants\n\n**Use cases:** Cryptocurrency, supply chain, voting systems.';
    }
    if (/quantum computing/i.test(lower)) {
      return '**Quantum Computing** uses quantum mechanics to process information.\n\n**Key Concepts:**\n\u2022 **Qubits:** Unlike bits (0 or 1), qubits can be 0, 1, or both simultaneously (superposition)\n\u2022 **Entanglement:** Qubits can be correlated\n\u2022 **Quantum Speedup:** Exponential for certain problems\n\n**Potential Impact:**\n\u2022 Drug discovery\n\u2022 Financial modeling\n\u2022 Cryptography\n\u2022 Optimization problems\n\nStill early stage, but IBM, Google, and Microsoft are making rapid progress.';
    }
    if (/cloud computing/i.test(lower)) {
      return '**Cloud Computing** delivers computing services over the internet.\n\n**Main Services:**\n\u2022 **IaaS:** Virtual machines (AWS EC2, Azure VMs)\n\u2022 **PaaS:** App platforms (Heroku, Vercel)\n\u2022 **SaaS:** Software (Gmail, Dropbox)\n\n**Major Providers:**\n\u2022 AWS (Amazon) \u2014 largest market share\n\u2022 Azure (Microsoft)\n\u2022 GCP (Google)\n\n**Benefits:** Pay-as-you-go, scalable, global reach.';
    }
    if (/cybersecurity/i.test(lower)) {
      return '**Cybersecurity** protects systems, networks, and data from digital attacks.\n\n**Key Areas:**\n\u2022 Network Security\n\u2022 Application Security\n\u2022 Cloud Security\n\u2022 Identity & Access Management\n\n**Common Threats:**\n\u2022 Phishing\n\u2022 Ransomware\n\u2022 SQL Injection\n\u2022 XSS (Cross-Site Scripting)\n\n**Best Practices:**\n\u2022 Use strong, unique passwords\n\u2022 Enable 2FA\n\u2022 Keep software updated';
    }
    if (/internet of things|\biot\b/i.test(lower)) {
      return '**IoT (Internet of Things)** connects everyday devices to the internet.\n\n**Examples:**\n\u2022 Smart home devices (Alexa, Google Home)\n\u2022 Wearables (Fitbit, Apple Watch)\n\u2022 Industrial sensors\n\u2022 Smart cities\n\n**By 2030:** Estimated 50+ billion IoT devices worldwide.';
    }
    if (/\b5g\b/i.test(lower)) {
      return '**5G** is the fifth generation of mobile network technology.\n\n**Speeds:** Up to 10 Gbps (100x faster than 4G)\n\n**Key Features:**\n\u2022 Ultra-low latency (<1ms)\n\u2022 Massive device connectivity\n\u2022 Network slicing\n\n**Applications:**\n\u2022 Autonomous vehicles\n\u2022 Remote surgery\n\u2022 Smart cities\n\u2022 AR/VR experiences';
    }

    // Generic knowledge
    var topicMatch = msg.match(/(?:what is|what are|who is|who was|define|explain|tell me about|kya hai|kya hota hai)\s+(.+)/i);
    if (topicMatch) {
      var topic = topicMatch[1].trim();
      return 'That\'s an excellent question about **' + topic + '**! \u{1F914}\n\nI have extensive knowledge about programming, technology, science, and more.\n\nFor the most accurate answer, could you tell me which category this falls into?\n\n\u2022 \u{1F4BB} **Programming** \u2014 JavaScript, Python, React, etc.\n\u2022 \u{1F527} **Technology** \u2014 APIs, databases, cloud, etc.\n\u2022 \u{1F52C} **Science** \u2014 Physics, chemistry, biology\n\u2022 \u{1F4CA} **Concepts** \u2014 ML, AI, blockchain, etc.\n\nOr just ask more specifically and I\'ll give you a comprehensive answer!';
    }

    return 'Interesting question! \u{1F9E0}\n\nI can provide detailed knowledge on many topics:\n\n\u2022 \u{1F4BB} **Programming:** JavaScript, Python, React, Node.js\n\u2022 \u{1F527} **Technology:** APIs, databases, Docker, Git\n\u2022 \u{1F52C} **Science:** ML, AI, quantum computing, cybersecurity\n\u2022 \u{1F310} **Internet:** IoT, 5G, cloud computing\n\nWhat specific topic interests you? I\'ll give you a thorough, well-explained answer!';
  }

  answerHowTo(lower, msg) {
    if (/how to (learn|start|begin)/i.test(lower)) {
      return '**How to Start Learning Programming** \u{1F680}\n\n**Step 1: Choose a Language**\n\u2022 Web Development \u2192 JavaScript (most versatile)\n\u2022 Data Science \u2192 Python (easiest to learn)\n\u2022 Mobile Apps \u2192 Kotlin/Swift\n\n**Step 2: Resources**\n\u2022 Free: freeCodeCamp, The Odin Project, CS50\n\u2022 Paid: Udemy, Coursera, Frontend Masters\n\n**Step 3: Build Projects**\n\u2022 Calculator \u2192 To-Do App \u2192 Blog \u2192 E-commerce\n\u2022 Each project teaches new concepts\n\n**Step 4: Join Communities**\n\u2022 GitHub, Stack Overflow, Reddit\n\u2022 Discord coding servers\n\n**Golden Rule:** Code every day, even if just 30 minutes. Consistency beats intensity! \u{1F4AA}';
    }

    if (/how to (git|deploy|host|publish)/i.test(lower)) {
      return '**How to Deploy Your App** \u{1F310}\n\n**Free Hosting Options:**\n\u2022 **Vercel** \u2014 Best for frontend/Next.js\n\u2022 **Netlify** \u2014 Great for static sites\n\u2022 **Heroku** \u2014 Good for Node.js backends\n\u2022 **Railway** \u2014 Modern, easy deployment\n\u2022 **GitHub Pages** \u2014 Free static hosting\n\n**Quick Deploy (Vercel):**\n```bash\nnpm i -g vercel\nvercel login\nvercel deploy\n```\n\n**For Full-Stack:**\n\u2022 Frontend \u2192 Vercel/Netlify\n\u2022 Backend \u2192 Railway/Render\n\u2022 Database \u2192 MongoDB Atlas (free tier)\n\nWant help with a specific deployment?';
    }

    return 'Great question! I\'d love to help you with this. \u{1F914}\n\nTo give you the best step-by-step guide, could you tell me more specifically what you need?\n\nFor example:\n\u2022 "How to learn JavaScript?"\n\u2022 "How to create a React app?"\n\u2022 "How to deploy a website?"\n\u2022 "How to use Git?"\n\nThe more specific you are, the better I can help! \u{1F680}';
  }

  thankYou() {
    var responses = [
      'You\'re welcome! \u{1F60A} Happy to help. Don\'t hesitate to ask if you need anything else \u2014 I\'m always here!',
      'Anytime! \u{1F64C} That\'s what I\'m here for. Got more questions? Bring them on!',
      'My pleasure! \u{1F49A} It\'s great being able to help. Feel free to ask me anything \u2014 no question is too small or too big.',
      'Glad I could help! \u2728 Remember, I\'m available 24/7. Just type your question anytime.'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // ===== SMART FALLBACK =====

  smartFallback(msg, lower) {
    if (/\?$/.test(msg.trim()) || /^(what|how|why|when|where|who|which|can|do|is|are|will|should|could|would)/i.test(lower)) {
      return 'That\'s a really interesting question! \u{1F914}\n\nI want to give you the most accurate answer possible. Here\'s what I can help with:\n\n\u{1F4BB} **Programming** \u2014 JavaScript, Python, React, HTML/CSS, Git, APIs\n\u{1F9EE} **Math** \u2014 Calculations, formulas, expressions\n\u{1F4DA} **Technology** \u2014 Databases, Docker, cloud, cybersecurity\n\u{1F3AD} **General** \u2014 Science, facts, jokes, motivation\n\nCould you tell me a bit more about what you\'re looking for? I\'ll give you a detailed, well-explained answer!';
    }

    if (/\b(bored|boring|nothing|idk|dunno|nm|hmm|ok|okay|alright|theek hai|accha)\b/i.test(lower)) {
      var casuals = [
        'Bored? Let me fix that! \u{1F604} How about I tell you a fun fact, a joke, or we discuss something interesting? I can also help you learn to code \u2014 that\'s never boring! What sounds fun?',
        'Nothing to do? Perfect time to learn something new! \u{1F680} I can teach you programming, share mind-blowing facts, or just have a fun conversation. What interests you?',
        'I get it \u2014 sometimes we all need a spark of inspiration! \u2728 Here\'s a question: If you could learn any programming language right now, which one would it be? I\'ll give you the ultimate beginner\'s guide!'
      ];
      return casuals[Math.floor(Math.random() * casuals.length)];
    }

    return 'I hear you! \u{1F917}\n\nI\'m at my best when I can give you specific, detailed answers. Here are some things I\'m really good at:\n\n\u{1F4BB} "What is a closure in JavaScript?"\n\u{1F9EE} "Calculate 256 * 345"\n\u{1F4DA} "Explain machine learning"\n\u{1F602} "Tell me a joke"\n\u23F0 "What time is it?"\n\u{1F3AF} "How to learn React?"\n\nTry asking something specific and watch me work my magic! \u2728';
  }
}

module.exports = new XhaodinAI();
