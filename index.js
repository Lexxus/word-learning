function App() {
  'use strict';

  const SERVICE_URL = 'https://glosbe.com/gapi/translate',
    CTX_SUBLEN_LIMIT = 250;

  var doc = document,
    form = doc.forms[0],
    resEl = doc.getElementById('res'),
    contextEl = doc.getElementById('context'),
    btnNextEl = doc.getElementById('btnNext'),
    btnPrevEl = doc.getElementById('btnPrev'),
    posEl = doc.getElementById('position'),
    dict = {},
    text = '',
    ctxWords = {},
    currentWord, beginPos, sortedDict, currentWord, nextShowIndex,
    scriptEl, translatingEl;

  function sort(obj) {
    return Object.keys(obj).sort(function(a, b) {
      var s = obj[b] - obj[a];

      if(s === 0) {
        s = a > b ? 1 : -1;
      }
      return s;
    });
  }

  function getJSON(url, data) {
    return new Promise(function(resolve, reject) {
      var req = new XMLHttpRequest(),
        query;

      if(data) {
        query = Object.keys(data).map(function(name) {
          return name + '=' + data[name];
        });
      }
      req.open('GET', url + (query ? '?' + query.join('&') : ''));

      req.onload = function() {
        if(req.status === 200) {
          resolve(req.response);
        }
        else {
          reject(Error(req.statusText));
        }
      };

      req.onerror = function() {
        reject(Error('Network error'));
      };

      req.send();
    });
  }

  function getJSONP(url, data) {
    var query;

    scriptEl = doc.createElement('script');
    if(data) {
      query = Object.keys(data).map(function(name) {
        return name + '=' + data[name];
      });
    }
    scriptEl.src = url + (query ? '?' + query.join('&') : '');
    doc.body.appendChild(scriptEl);
  }

  function toggleContext(show) {
    doc.getElementById('contextWrapper').style.display = show ? null : 'none';
  }

  function showResult(from, len) {
    var end, i;

    function appendWord(word) {
      setTimeout(function() {
        var el = doc.createElement('li');

        el.innerHTML += '<span class="word"><a href="#' + word + '">' + word + '</a></span>'
          + ': ' + dict[word] + ' <i data-src="' + word + '"></i>';
        resEl.appendChild(el);
      }, 0);
    }

    len = len || 100;
    end = from + len;

    for(i = from; i < end; i++) {
      appendWord(sortedDict[i]);
    }
    nextShowIndex = end;
  }

  function toggleButtons(prev, next) {
    btnPrevEl.style.display = prev ? null : 'none';
    btnNextEl.style.display = next ? null : 'none';
  }

  function getSentence(ctxPos) {
    return text.substring(ctxPos.start, ctxPos.end).replace(ctxPos.word, '<b>' + ctxPos.word + '</b>');
  }

  function setContext(word, prev) {
    var word1 = word[0].toUpperCase() + word.substr(1),
      rx = /\w/,
      rx1 = /\W|\d/,
      from = 0,
      ctx = ctxWords[word],
      i, i1, i2, pos, w, startPos, ctxPos;

    if (ctx) {
      i = ctx.current + (prev ? -1 : 1);
      ctxPos = ctx.poss[i];
      if (!ctxPos && ctx.done) {
        if (prev) {
          i = ctx.poss.length - 1;
        }
        else {
          i = 0;
        }
        ctxPos = ctx.poss[i];
      }
      if (ctxPos) {
        ctx.current = i;
      }
      from = ctx.poss[ctx.current].end;
    }
    if(!ctxPos) {
      do {
        i1 = text.indexOf(word, from);
        i2 = text.indexOf(word1, from);
        if(i1 >= 0 && (i1 < i2 || i2 < 0)) {
          pos = i1;
          w = word;
        }
        else if(i2 >= 0) {
          pos = i2;
          w = word1;
        } else {
          w = '.';
        }
        if(pos >= 0 && (rx.test(text[pos - 1]) || rx.test(text[pos + word.length]))) {
          w = '';
          from += word.length;
        }
      } while(!w && from < text.length);

      if(!w || w === '.') {
        if (ctx) {
          ctx.done = true;
          ctx.current = 0;
          ctxPos = ctx.poss[0];
        }
      }
      else {
        i = pos - 1;
        rx = /[^.?!]/;

        while(i && (pos - i < CTX_SUBLEN_LIMIT && rx.test(text[i]) || !rx1.test(text[i]))) {
          i--;
        }
        startPos = i + 1;
        i = pos += w.length;
        while(i < text.length && (i - pos < CTX_SUBLEN_LIMIT && rx.test(text[i]) || !rx1.test(text[i]))) {
          i++;
        }
        ctxPos = {
          start: startPos,
          end: i + 1,
          word: w,
          position: Math.round(pos / text.length * 100)
        };
        if (!ctx) {
          ctx = ctxWords[word] = {
            current: 0,
            poss: [ctxPos]
          };
        }
        else {
          ctx.poss.push(ctxPos);
          ctx.current++;
        }
      }
    }
    toggleButtons(
      ctx.current || (ctx.done && ctx.poss.length > 1),
      ctx.poss.length > 1 || !ctx.done
    );

    if(ctxPos) {
      contextEl.innerHTML = getSentence(ctxPos);
      posEl.innerHTML = ctxPos.position + '%';
    }
    else {
      contextEl.innerHTML = '';
    }
  }

  function showContext(word, prev) {
    if(word) {
      currentWord = word;
    }
    else {
      word = currentWord;
    }

    setContext(word, prev);
  }

  function clickWord(e) {
    var a = e.target,
      word;

    if (a.tagName !== 'A') {
      return;
    }
    e.preventDefault();
    word = a.hash.substr(1);
    toggleContext(true);
    if(!ctxWords[word]) {
      getJSONP(SERVICE_URL, {
        from: form.lang_src.value,
        dest: form.lang_dest.value,
        format: 'json',
        phrase: word,
        callback: 'app.translate'
      });
    }
    showContext(word);
  }

  function getText(data) {
    var tuc = data.tuc,
      text = '',
      phrase;

    if(data.result === 'ok') {
      if(tuc && tuc[0]) {
        phrase = tuc[0].phrase;
        if(phrase && phrase.text) {
          text = phrase.text;
        }
        else {
          phrase = tuc[0].meanings && tuc[0].meanings[0];
          if (phrase && phrase.text) {
            text = phrase.text;
          }
        }
      }
    }
    return text;
  }

  function process(e) {
    var file = form.file.files[0],
      outEl = doc.getElementById('out'),
      reader;

    e.preventDefault();

    if(!file) {
      return;
    }

    reader = new FileReader();

    reader.onload = function(e) {
      var start = 0,
        step = 5000,
        size, xml, txt, end, list, i, w;

      xml = e.target.result;
      size = xml.length;
      outEl.innerHTML += ' size: ' + size + '</p>';

      if (file.name.split('.').pop().toLowerCase() === 'fb2') {
        start = xml.indexOf('<body>');
        if (start < 0) {
          start = xml.indexOf('<BODY>');
        }
        start += 6;
      }
      beginPos = start;

      while(start < size) {
        end = start + step;

        if (end < size) {
          while(end < size && xml[end] !== '>') {
            end++;
          }
        } else {
          end = size - 1;
        }
        txt = xml.substr(start, end - start + 1).replace(/<.+?>/g, '');
        list = txt.match(/[a-zA-Z]{2,}/g);
        for(i = 0; w = list[i]; i++) {
          if (w !== 'll') {
            w = w.toLowerCase();
            if (!dict[w]) {
              dict[w] = 1;
            } else {
              dict[w]++;
            }
          }
        }
        text += txt;
        start = end + 1;
      }
      sortedDict = sort(dict);
      outEl.innerHTML += '<p>Words: <b>' + sortedDict.length + '</b></p>';
      doc.getElementById('dict').style.display = 'block';
      showResult(0);
      translatingEl = null;
    };

    reader.readAsText(file);

    outEl.innerHTML = '<p>Processing - <code>' + file.name + '</code>';
  }

  toggleContext();

  form.addEventListener('submit', process);
  doc.getElementById('more').addEventListener('click', function() {
    showResult(nextShowIndex);
  });
  resEl.addEventListener('click', clickWord);
  btnNextEl.addEventListener('click', function() {
    showContext();
  });
  btnPrevEl.addEventListener('click', function() {
    showContext(null, true);
  });

  this.translate = function(data) {
    var word = data.phrase,
      tuc = data.tuc,
      el = doc.querySelector('i[data-src=' + word + ']'),
      text = getText(data),
      words;

    scriptEl.remove();

    el.innerHTML = text;
    words = el.textContent.match(/\w+/g);
    if(words && words.length > 1 && !translatingEl) {
      translatingEl = el;
      getJSONP(SERVICE_URL, {
        from: form.lang_src.value,
        dest: form.lang_dest.value,
        format: 'json',
        phrase: words.pop(),
        callback: 'app.addTranslation'
      });
    }
  };

  this.addTranslation = function(data) {
    var text = getText(data);

    scriptEl.remove();

    translatingEl.innerHTML += ' - ' + text;
    translatingEl = null;
  }
}

window.app = new App();
