var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  __markAsModule(target);
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, { get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable });
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? { get: () => module2.default, enumerable: true } : { value: module2, enumerable: true })), module2);
};

// node_modules/regexp-match-indices/config.js
var require_config = __commonJS({
  "node_modules/regexp-match-indices/config.js"(exports, module2) {
    "use strict";
    var config = {
      mode: "lazy"
    };
    module2.exports = config;
  }
});

// node_modules/regexp-match-indices/native.js
var require_native = __commonJS({
  "node_modules/regexp-match-indices/native.js"(exports, module2) {
    "use strict";
    var nativeExec = RegExp.prototype.exec;
    module2.exports = nativeExec;
  }
});

// node_modules/regexp-tree/dist/compat-transpiler/transforms/compat-dotall-s-transform.js
var require_compat_dotall_s_transform = __commonJS({
  "node_modules/regexp-tree/dist/compat-transpiler/transforms/compat-dotall-s-transform.js"(exports, module2) {
    "use strict";
    module2.exports = {
      _hasUFlag: false,
      shouldRun: function shouldRun(ast) {
        var shouldRun2 = ast.flags.includes("s");
        if (!shouldRun2) {
          return false;
        }
        ast.flags = ast.flags.replace("s", "");
        this._hasUFlag = ast.flags.includes("u");
        return true;
      },
      Char: function Char(path) {
        var node = path.node;
        if (node.kind !== "meta" || node.value !== ".") {
          return;
        }
        var toValue = "\\uFFFF";
        var toSymbol = "\uFFFF";
        if (this._hasUFlag) {
          toValue = "\\u{10FFFF}";
          toSymbol = "\u{10FFFF}";
        }
        path.replace({
          type: "CharacterClass",
          expressions: [{
            type: "ClassRange",
            from: {
              type: "Char",
              value: "\\0",
              kind: "decimal",
              symbol: "\0"
            },
            to: {
              type: "Char",
              value: toValue,
              kind: "unicode",
              symbol: toSymbol
            }
          }]
        });
      }
    };
  }
});

// node_modules/regexp-tree/dist/compat-transpiler/transforms/compat-named-capturing-groups-transform.js
var require_compat_named_capturing_groups_transform = __commonJS({
  "node_modules/regexp-tree/dist/compat-transpiler/transforms/compat-named-capturing-groups-transform.js"(exports, module2) {
    "use strict";
    module2.exports = {
      _groupNames: {},
      init: function init() {
        this._groupNames = {};
      },
      getExtra: function getExtra() {
        return this._groupNames;
      },
      Group: function Group(path) {
        var node = path.node;
        if (!node.name) {
          return;
        }
        this._groupNames[node.name] = node.number;
        delete node.name;
        delete node.nameRaw;
      },
      Backreference: function Backreference(path) {
        var node = path.node;
        if (node.kind !== "name") {
          return;
        }
        node.kind = "number";
        node.reference = node.number;
        delete node.referenceRaw;
      }
    };
  }
});

// node_modules/regexp-tree/dist/compat-transpiler/transforms/compat-x-flag-transform.js
var require_compat_x_flag_transform = __commonJS({
  "node_modules/regexp-tree/dist/compat-transpiler/transforms/compat-x-flag-transform.js"(exports, module2) {
    "use strict";
    module2.exports = {
      RegExp: function RegExp2(_ref) {
        var node = _ref.node;
        if (node.flags.includes("x")) {
          node.flags = node.flags.replace("x", "");
        }
      }
    };
  }
});

// node_modules/regexp-tree/dist/compat-transpiler/transforms/index.js
var require_transforms = __commonJS({
  "node_modules/regexp-tree/dist/compat-transpiler/transforms/index.js"(exports, module2) {
    "use strict";
    module2.exports = {
      dotAll: require_compat_dotall_s_transform(),
      namedCapturingGroups: require_compat_named_capturing_groups_transform(),
      xFlag: require_compat_x_flag_transform()
    };
  }
});

// node_modules/regexp-tree/dist/generator/index.js
var require_generator = __commonJS({
  "node_modules/regexp-tree/dist/generator/index.js"(exports, module2) {
    "use strict";
    function gen(node) {
      return node ? generator[node.type](node) : "";
    }
    var generator = {
      RegExp: function RegExp2(node) {
        return "/" + gen(node.body) + "/" + node.flags;
      },
      Alternative: function Alternative(node) {
        return (node.expressions || []).map(gen).join("");
      },
      Disjunction: function Disjunction(node) {
        return gen(node.left) + "|" + gen(node.right);
      },
      Group: function Group(node) {
        var expression = gen(node.expression);
        if (node.capturing) {
          if (node.name) {
            return "(?<" + (node.nameRaw || node.name) + ">" + expression + ")";
          }
          return "(" + expression + ")";
        }
        return "(?:" + expression + ")";
      },
      Backreference: function Backreference(node) {
        switch (node.kind) {
          case "number":
            return "\\" + node.reference;
          case "name":
            return "\\k<" + (node.referenceRaw || node.reference) + ">";
          default:
            throw new TypeError("Unknown Backreference kind: " + node.kind);
        }
      },
      Assertion: function Assertion(node) {
        switch (node.kind) {
          case "^":
          case "$":
          case "\\b":
          case "\\B":
            return node.kind;
          case "Lookahead": {
            var assertion = gen(node.assertion);
            if (node.negative) {
              return "(?!" + assertion + ")";
            }
            return "(?=" + assertion + ")";
          }
          case "Lookbehind": {
            var _assertion = gen(node.assertion);
            if (node.negative) {
              return "(?<!" + _assertion + ")";
            }
            return "(?<=" + _assertion + ")";
          }
          default:
            throw new TypeError("Unknown Assertion kind: " + node.kind);
        }
      },
      CharacterClass: function CharacterClass(node) {
        var expressions = node.expressions.map(gen).join("");
        if (node.negative) {
          return "[^" + expressions + "]";
        }
        return "[" + expressions + "]";
      },
      ClassRange: function ClassRange(node) {
        return gen(node.from) + "-" + gen(node.to);
      },
      Repetition: function Repetition(node) {
        return "" + gen(node.expression) + gen(node.quantifier);
      },
      Quantifier: function Quantifier(node) {
        var quantifier = void 0;
        var greedy = node.greedy ? "" : "?";
        switch (node.kind) {
          case "+":
          case "?":
          case "*":
            quantifier = node.kind;
            break;
          case "Range":
            if (node.from === node.to) {
              quantifier = "{" + node.from + "}";
            } else if (!node.to) {
              quantifier = "{" + node.from + ",}";
            } else {
              quantifier = "{" + node.from + "," + node.to + "}";
            }
            break;
          default:
            throw new TypeError("Unknown Quantifier kind: " + node.kind);
        }
        return "" + quantifier + greedy;
      },
      Char: function Char(node) {
        var value = node.value;
        switch (node.kind) {
          case "simple": {
            if (node.escaped) {
              return "\\" + value;
            }
            return value;
          }
          case "hex":
          case "unicode":
          case "oct":
          case "decimal":
          case "control":
          case "meta":
            return value;
          default:
            throw new TypeError("Unknown Char kind: " + node.kind);
        }
      },
      UnicodeProperty: function UnicodeProperty(node) {
        var escapeChar = node.negative ? "P" : "p";
        var namePart = void 0;
        if (!node.shorthand && !node.binary) {
          namePart = node.name + "=";
        } else {
          namePart = "";
        }
        return "\\" + escapeChar + "{" + namePart + node.value + "}";
      }
    };
    module2.exports = {
      generate: gen
    };
  }
});

// node_modules/regexp-tree/dist/parser/unicode/parser-unicode-properties.js
var require_parser_unicode_properties = __commonJS({
  "node_modules/regexp-tree/dist/parser/unicode/parser-unicode-properties.js"(exports, module2) {
    "use strict";
    var NON_BINARY_PROP_NAMES_TO_ALIASES = {
      General_Category: "gc",
      Script: "sc",
      Script_Extensions: "scx"
    };
    var NON_BINARY_ALIASES_TO_PROP_NAMES = inverseMap(NON_BINARY_PROP_NAMES_TO_ALIASES);
    var BINARY_PROP_NAMES_TO_ALIASES = {
      ASCII: "ASCII",
      ASCII_Hex_Digit: "AHex",
      Alphabetic: "Alpha",
      Any: "Any",
      Assigned: "Assigned",
      Bidi_Control: "Bidi_C",
      Bidi_Mirrored: "Bidi_M",
      Case_Ignorable: "CI",
      Cased: "Cased",
      Changes_When_Casefolded: "CWCF",
      Changes_When_Casemapped: "CWCM",
      Changes_When_Lowercased: "CWL",
      Changes_When_NFKC_Casefolded: "CWKCF",
      Changes_When_Titlecased: "CWT",
      Changes_When_Uppercased: "CWU",
      Dash: "Dash",
      Default_Ignorable_Code_Point: "DI",
      Deprecated: "Dep",
      Diacritic: "Dia",
      Emoji: "Emoji",
      Emoji_Component: "Emoji_Component",
      Emoji_Modifier: "Emoji_Modifier",
      Emoji_Modifier_Base: "Emoji_Modifier_Base",
      Emoji_Presentation: "Emoji_Presentation",
      Extended_Pictographic: "Extended_Pictographic",
      Extender: "Ext",
      Grapheme_Base: "Gr_Base",
      Grapheme_Extend: "Gr_Ext",
      Hex_Digit: "Hex",
      IDS_Binary_Operator: "IDSB",
      IDS_Trinary_Operator: "IDST",
      ID_Continue: "IDC",
      ID_Start: "IDS",
      Ideographic: "Ideo",
      Join_Control: "Join_C",
      Logical_Order_Exception: "LOE",
      Lowercase: "Lower",
      Math: "Math",
      Noncharacter_Code_Point: "NChar",
      Pattern_Syntax: "Pat_Syn",
      Pattern_White_Space: "Pat_WS",
      Quotation_Mark: "QMark",
      Radical: "Radical",
      Regional_Indicator: "RI",
      Sentence_Terminal: "STerm",
      Soft_Dotted: "SD",
      Terminal_Punctuation: "Term",
      Unified_Ideograph: "UIdeo",
      Uppercase: "Upper",
      Variation_Selector: "VS",
      White_Space: "space",
      XID_Continue: "XIDC",
      XID_Start: "XIDS"
    };
    var BINARY_ALIASES_TO_PROP_NAMES = inverseMap(BINARY_PROP_NAMES_TO_ALIASES);
    var GENERAL_CATEGORY_VALUE_TO_ALIASES = {
      Cased_Letter: "LC",
      Close_Punctuation: "Pe",
      Connector_Punctuation: "Pc",
      Control: ["Cc", "cntrl"],
      Currency_Symbol: "Sc",
      Dash_Punctuation: "Pd",
      Decimal_Number: ["Nd", "digit"],
      Enclosing_Mark: "Me",
      Final_Punctuation: "Pf",
      Format: "Cf",
      Initial_Punctuation: "Pi",
      Letter: "L",
      Letter_Number: "Nl",
      Line_Separator: "Zl",
      Lowercase_Letter: "Ll",
      Mark: ["M", "Combining_Mark"],
      Math_Symbol: "Sm",
      Modifier_Letter: "Lm",
      Modifier_Symbol: "Sk",
      Nonspacing_Mark: "Mn",
      Number: "N",
      Open_Punctuation: "Ps",
      Other: "C",
      Other_Letter: "Lo",
      Other_Number: "No",
      Other_Punctuation: "Po",
      Other_Symbol: "So",
      Paragraph_Separator: "Zp",
      Private_Use: "Co",
      Punctuation: ["P", "punct"],
      Separator: "Z",
      Space_Separator: "Zs",
      Spacing_Mark: "Mc",
      Surrogate: "Cs",
      Symbol: "S",
      Titlecase_Letter: "Lt",
      Unassigned: "Cn",
      Uppercase_Letter: "Lu"
    };
    var GENERAL_CATEGORY_VALUE_ALIASES_TO_VALUES = inverseMap(GENERAL_CATEGORY_VALUE_TO_ALIASES);
    var SCRIPT_VALUE_TO_ALIASES = {
      Adlam: "Adlm",
      Ahom: "Ahom",
      Anatolian_Hieroglyphs: "Hluw",
      Arabic: "Arab",
      Armenian: "Armn",
      Avestan: "Avst",
      Balinese: "Bali",
      Bamum: "Bamu",
      Bassa_Vah: "Bass",
      Batak: "Batk",
      Bengali: "Beng",
      Bhaiksuki: "Bhks",
      Bopomofo: "Bopo",
      Brahmi: "Brah",
      Braille: "Brai",
      Buginese: "Bugi",
      Buhid: "Buhd",
      Canadian_Aboriginal: "Cans",
      Carian: "Cari",
      Caucasian_Albanian: "Aghb",
      Chakma: "Cakm",
      Cham: "Cham",
      Cherokee: "Cher",
      Common: "Zyyy",
      Coptic: ["Copt", "Qaac"],
      Cuneiform: "Xsux",
      Cypriot: "Cprt",
      Cyrillic: "Cyrl",
      Deseret: "Dsrt",
      Devanagari: "Deva",
      Dogra: "Dogr",
      Duployan: "Dupl",
      Egyptian_Hieroglyphs: "Egyp",
      Elbasan: "Elba",
      Ethiopic: "Ethi",
      Georgian: "Geor",
      Glagolitic: "Glag",
      Gothic: "Goth",
      Grantha: "Gran",
      Greek: "Grek",
      Gujarati: "Gujr",
      Gunjala_Gondi: "Gong",
      Gurmukhi: "Guru",
      Han: "Hani",
      Hangul: "Hang",
      Hanifi_Rohingya: "Rohg",
      Hanunoo: "Hano",
      Hatran: "Hatr",
      Hebrew: "Hebr",
      Hiragana: "Hira",
      Imperial_Aramaic: "Armi",
      Inherited: ["Zinh", "Qaai"],
      Inscriptional_Pahlavi: "Phli",
      Inscriptional_Parthian: "Prti",
      Javanese: "Java",
      Kaithi: "Kthi",
      Kannada: "Knda",
      Katakana: "Kana",
      Kayah_Li: "Kali",
      Kharoshthi: "Khar",
      Khmer: "Khmr",
      Khojki: "Khoj",
      Khudawadi: "Sind",
      Lao: "Laoo",
      Latin: "Latn",
      Lepcha: "Lepc",
      Limbu: "Limb",
      Linear_A: "Lina",
      Linear_B: "Linb",
      Lisu: "Lisu",
      Lycian: "Lyci",
      Lydian: "Lydi",
      Mahajani: "Mahj",
      Makasar: "Maka",
      Malayalam: "Mlym",
      Mandaic: "Mand",
      Manichaean: "Mani",
      Marchen: "Marc",
      Medefaidrin: "Medf",
      Masaram_Gondi: "Gonm",
      Meetei_Mayek: "Mtei",
      Mende_Kikakui: "Mend",
      Meroitic_Cursive: "Merc",
      Meroitic_Hieroglyphs: "Mero",
      Miao: "Plrd",
      Modi: "Modi",
      Mongolian: "Mong",
      Mro: "Mroo",
      Multani: "Mult",
      Myanmar: "Mymr",
      Nabataean: "Nbat",
      New_Tai_Lue: "Talu",
      Newa: "Newa",
      Nko: "Nkoo",
      Nushu: "Nshu",
      Ogham: "Ogam",
      Ol_Chiki: "Olck",
      Old_Hungarian: "Hung",
      Old_Italic: "Ital",
      Old_North_Arabian: "Narb",
      Old_Permic: "Perm",
      Old_Persian: "Xpeo",
      Old_Sogdian: "Sogo",
      Old_South_Arabian: "Sarb",
      Old_Turkic: "Orkh",
      Oriya: "Orya",
      Osage: "Osge",
      Osmanya: "Osma",
      Pahawh_Hmong: "Hmng",
      Palmyrene: "Palm",
      Pau_Cin_Hau: "Pauc",
      Phags_Pa: "Phag",
      Phoenician: "Phnx",
      Psalter_Pahlavi: "Phlp",
      Rejang: "Rjng",
      Runic: "Runr",
      Samaritan: "Samr",
      Saurashtra: "Saur",
      Sharada: "Shrd",
      Shavian: "Shaw",
      Siddham: "Sidd",
      SignWriting: "Sgnw",
      Sinhala: "Sinh",
      Sogdian: "Sogd",
      Sora_Sompeng: "Sora",
      Soyombo: "Soyo",
      Sundanese: "Sund",
      Syloti_Nagri: "Sylo",
      Syriac: "Syrc",
      Tagalog: "Tglg",
      Tagbanwa: "Tagb",
      Tai_Le: "Tale",
      Tai_Tham: "Lana",
      Tai_Viet: "Tavt",
      Takri: "Takr",
      Tamil: "Taml",
      Tangut: "Tang",
      Telugu: "Telu",
      Thaana: "Thaa",
      Thai: "Thai",
      Tibetan: "Tibt",
      Tifinagh: "Tfng",
      Tirhuta: "Tirh",
      Ugaritic: "Ugar",
      Vai: "Vaii",
      Warang_Citi: "Wara",
      Yi: "Yiii",
      Zanabazar_Square: "Zanb"
    };
    var SCRIPT_VALUE_ALIASES_TO_VALUE = inverseMap(SCRIPT_VALUE_TO_ALIASES);
    function inverseMap(data) {
      var inverse = {};
      for (var name in data) {
        if (!data.hasOwnProperty(name)) {
          continue;
        }
        var value = data[name];
        if (Array.isArray(value)) {
          for (var i = 0; i < value.length; i++) {
            inverse[value[i]] = name;
          }
        } else {
          inverse[value] = name;
        }
      }
      return inverse;
    }
    function isValidName(name) {
      return NON_BINARY_PROP_NAMES_TO_ALIASES.hasOwnProperty(name) || NON_BINARY_ALIASES_TO_PROP_NAMES.hasOwnProperty(name) || BINARY_PROP_NAMES_TO_ALIASES.hasOwnProperty(name) || BINARY_ALIASES_TO_PROP_NAMES.hasOwnProperty(name);
    }
    function isValidValue(name, value) {
      if (isGeneralCategoryName(name)) {
        return isGeneralCategoryValue(value);
      }
      if (isScriptCategoryName(name)) {
        return isScriptCategoryValue(value);
      }
      return false;
    }
    function isAlias(name) {
      return NON_BINARY_ALIASES_TO_PROP_NAMES.hasOwnProperty(name) || BINARY_ALIASES_TO_PROP_NAMES.hasOwnProperty(name);
    }
    function isGeneralCategoryName(name) {
      return name === "General_Category" || name == "gc";
    }
    function isScriptCategoryName(name) {
      return name === "Script" || name === "Script_Extensions" || name === "sc" || name === "scx";
    }
    function isGeneralCategoryValue(value) {
      return GENERAL_CATEGORY_VALUE_TO_ALIASES.hasOwnProperty(value) || GENERAL_CATEGORY_VALUE_ALIASES_TO_VALUES.hasOwnProperty(value);
    }
    function isScriptCategoryValue(value) {
      return SCRIPT_VALUE_TO_ALIASES.hasOwnProperty(value) || SCRIPT_VALUE_ALIASES_TO_VALUE.hasOwnProperty(value);
    }
    function isBinaryPropertyName(name) {
      return BINARY_PROP_NAMES_TO_ALIASES.hasOwnProperty(name) || BINARY_ALIASES_TO_PROP_NAMES.hasOwnProperty(name);
    }
    function getCanonicalName(name) {
      if (NON_BINARY_ALIASES_TO_PROP_NAMES.hasOwnProperty(name)) {
        return NON_BINARY_ALIASES_TO_PROP_NAMES[name];
      }
      if (BINARY_ALIASES_TO_PROP_NAMES.hasOwnProperty(name)) {
        return BINARY_ALIASES_TO_PROP_NAMES[name];
      }
      return null;
    }
    function getCanonicalValue(value) {
      if (GENERAL_CATEGORY_VALUE_ALIASES_TO_VALUES.hasOwnProperty(value)) {
        return GENERAL_CATEGORY_VALUE_ALIASES_TO_VALUES[value];
      }
      if (SCRIPT_VALUE_ALIASES_TO_VALUE.hasOwnProperty(value)) {
        return SCRIPT_VALUE_ALIASES_TO_VALUE[value];
      }
      if (BINARY_ALIASES_TO_PROP_NAMES.hasOwnProperty(value)) {
        return BINARY_ALIASES_TO_PROP_NAMES[value];
      }
      return null;
    }
    module2.exports = {
      isAlias,
      isValidName,
      isValidValue,
      isGeneralCategoryValue,
      isScriptCategoryValue,
      isBinaryPropertyName,
      getCanonicalName,
      getCanonicalValue,
      NON_BINARY_PROP_NAMES_TO_ALIASES,
      NON_BINARY_ALIASES_TO_PROP_NAMES,
      BINARY_PROP_NAMES_TO_ALIASES,
      BINARY_ALIASES_TO_PROP_NAMES,
      GENERAL_CATEGORY_VALUE_TO_ALIASES,
      GENERAL_CATEGORY_VALUE_ALIASES_TO_VALUES,
      SCRIPT_VALUE_TO_ALIASES,
      SCRIPT_VALUE_ALIASES_TO_VALUE
    };
  }
});

// node_modules/regexp-tree/dist/parser/generated/regexp-tree.js
var require_regexp_tree = __commonJS({
  "node_modules/regexp-tree/dist/parser/generated/regexp-tree.js"(exports, module2) {
    "use strict";
    var _slicedToArray = function() {
      function sliceIterator(arr, i) {
        var _arr = [];
        var _n = true;
        var _d = false;
        var _e = void 0;
        try {
          for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
            _arr.push(_s.value);
            if (i && _arr.length === i)
              break;
          }
        } catch (err) {
          _d = true;
          _e = err;
        } finally {
          try {
            if (!_n && _i["return"])
              _i["return"]();
          } finally {
            if (_d)
              throw _e;
          }
        }
        return _arr;
      }
      return function(arr, i) {
        if (Array.isArray(arr)) {
          return arr;
        } else if (Symbol.iterator in Object(arr)) {
          return sliceIterator(arr, i);
        } else {
          throw new TypeError("Invalid attempt to destructure non-iterable instance");
        }
      };
    }();
    function _toConsumableArray(arr) {
      if (Array.isArray(arr)) {
        for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
          arr2[i] = arr[i];
        }
        return arr2;
      } else {
        return Array.from(arr);
      }
    }
    var yytext = void 0;
    var yyleng = void 0;
    var yy = {};
    var __ = void 0;
    var __loc = void 0;
    function yyloc(start, end) {
      if (!yy.options.captureLocations) {
        return null;
      }
      if (!start || !end) {
        return start || end;
      }
      return {
        startOffset: start.startOffset,
        endOffset: end.endOffset,
        startLine: start.startLine,
        endLine: end.endLine,
        startColumn: start.startColumn,
        endColumn: end.endColumn
      };
    }
    var EOF = "$";
    var productions = [[-1, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [0, 4, function(_1, _2, _3, _4, _1loc, _2loc, _3loc, _4loc) {
      __loc = yyloc(_1loc, _4loc);
      __ = Node({
        type: "RegExp",
        body: _2,
        flags: checkFlags(_4)
      }, loc(_1loc, _4loc || _3loc));
    }], [1, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [1, 0, function() {
      __loc = null;
      __ = "";
    }], [2, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [2, 2, function(_1, _2, _1loc, _2loc) {
      __loc = yyloc(_1loc, _2loc);
      __ = _1 + _2;
    }], [3, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [4, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [4, 3, function(_1, _2, _3, _1loc, _2loc, _3loc) {
      __loc = yyloc(_1loc, _3loc);
      var _loc = null;
      if (_2loc) {
        _loc = loc(_1loc || _2loc, _3loc || _2loc);
      }
      ;
      __ = Node({
        type: "Disjunction",
        left: _1,
        right: _3
      }, _loc);
    }], [5, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      if (_1.length === 0) {
        __ = null;
        return;
      }
      if (_1.length === 1) {
        __ = Node(_1[0], __loc);
      } else {
        __ = Node({
          type: "Alternative",
          expressions: _1
        }, __loc);
      }
    }], [6, 0, function() {
      __loc = null;
      __ = [];
    }], [6, 2, function(_1, _2, _1loc, _2loc) {
      __loc = yyloc(_1loc, _2loc);
      __ = _1.concat(_2);
    }], [7, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Node(Object.assign({ type: "Assertion" }, _1), __loc);
    }], [7, 2, function(_1, _2, _1loc, _2loc) {
      __loc = yyloc(_1loc, _2loc);
      __ = _1;
      if (_2) {
        __ = Node({
          type: "Repetition",
          expression: _1,
          quantifier: _2
        }, __loc);
      }
    }], [8, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = { kind: "^" };
    }], [8, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = { kind: "$" };
    }], [8, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = { kind: "\\b" };
    }], [8, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = { kind: "\\B" };
    }], [8, 3, function(_1, _2, _3, _1loc, _2loc, _3loc) {
      __loc = yyloc(_1loc, _3loc);
      __ = {
        kind: "Lookahead",
        assertion: _2
      };
    }], [8, 3, function(_1, _2, _3, _1loc, _2loc, _3loc) {
      __loc = yyloc(_1loc, _3loc);
      __ = {
        kind: "Lookahead",
        negative: true,
        assertion: _2
      };
    }], [8, 3, function(_1, _2, _3, _1loc, _2loc, _3loc) {
      __loc = yyloc(_1loc, _3loc);
      __ = {
        kind: "Lookbehind",
        assertion: _2
      };
    }], [8, 3, function(_1, _2, _3, _1loc, _2loc, _3loc) {
      __loc = yyloc(_1loc, _3loc);
      __ = {
        kind: "Lookbehind",
        negative: true,
        assertion: _2
      };
    }], [9, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [9, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [9, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Char(_1, "simple", __loc);
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Char(_1.slice(1), "simple", __loc);
      __.escaped = true;
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Char(_1, "unicode", __loc);
      __.isSurrogatePair = true;
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Char(_1, "unicode", __loc);
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = UnicodeProperty(_1, __loc);
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Char(_1, "control", __loc);
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Char(_1, "hex", __loc);
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Char(_1, "oct", __loc);
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = GroupRefOrDecChar(_1, __loc);
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Char(_1, "meta", __loc);
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Char(_1, "meta", __loc);
    }], [10, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = NamedGroupRefOrChars(_1, _1loc);
    }], [11, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [11, 0], [12, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [12, 2, function(_1, _2, _1loc, _2loc) {
      __loc = yyloc(_1loc, _2loc);
      _1.greedy = false;
      __ = _1;
    }], [13, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Node({
        type: "Quantifier",
        kind: _1,
        greedy: true
      }, __loc);
    }], [13, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Node({
        type: "Quantifier",
        kind: _1,
        greedy: true
      }, __loc);
    }], [13, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Node({
        type: "Quantifier",
        kind: _1,
        greedy: true
      }, __loc);
    }], [13, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      var range = getRange(_1);
      __ = Node({
        type: "Quantifier",
        kind: "Range",
        from: range[0],
        to: range[0],
        greedy: true
      }, __loc);
    }], [13, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Node({
        type: "Quantifier",
        kind: "Range",
        from: getRange(_1)[0],
        greedy: true
      }, __loc);
    }], [13, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      var range = getRange(_1);
      __ = Node({
        type: "Quantifier",
        kind: "Range",
        from: range[0],
        to: range[1],
        greedy: true
      }, __loc);
    }], [14, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [14, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [15, 3, function(_1, _2, _3, _1loc, _2loc, _3loc) {
      __loc = yyloc(_1loc, _3loc);
      var nameRaw = String(_1);
      var name = decodeUnicodeGroupName(nameRaw);
      if (!yy.options.allowGroupNameDuplicates && namedGroups.hasOwnProperty(name)) {
        throw new SyntaxError('Duplicate of the named group "' + name + '".');
      }
      namedGroups[name] = _1.groupNumber;
      __ = Node({
        type: "Group",
        capturing: true,
        name,
        nameRaw,
        number: _1.groupNumber,
        expression: _2
      }, __loc);
    }], [15, 3, function(_1, _2, _3, _1loc, _2loc, _3loc) {
      __loc = yyloc(_1loc, _3loc);
      __ = Node({
        type: "Group",
        capturing: true,
        number: _1.groupNumber,
        expression: _2
      }, __loc);
    }], [16, 3, function(_1, _2, _3, _1loc, _2loc, _3loc) {
      __loc = yyloc(_1loc, _3loc);
      __ = Node({
        type: "Group",
        capturing: false,
        expression: _2
      }, __loc);
    }], [17, 3, function(_1, _2, _3, _1loc, _2loc, _3loc) {
      __loc = yyloc(_1loc, _3loc);
      __ = Node({
        type: "CharacterClass",
        negative: true,
        expressions: _2
      }, __loc);
    }], [17, 3, function(_1, _2, _3, _1loc, _2loc, _3loc) {
      __loc = yyloc(_1loc, _3loc);
      __ = Node({
        type: "CharacterClass",
        expressions: _2
      }, __loc);
    }], [18, 0, function() {
      __loc = null;
      __ = [];
    }], [18, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [19, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = [_1];
    }], [19, 2, function(_1, _2, _1loc, _2loc) {
      __loc = yyloc(_1loc, _2loc);
      __ = [_1].concat(_2);
    }], [19, 4, function(_1, _2, _3, _4, _1loc, _2loc, _3loc, _4loc) {
      __loc = yyloc(_1loc, _4loc);
      checkClassRange(_1, _3);
      __ = [Node({
        type: "ClassRange",
        from: _1,
        to: _3
      }, loc(_1loc, _3loc))];
      if (_4) {
        __ = __.concat(_4);
      }
    }], [20, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [20, 2, function(_1, _2, _1loc, _2loc) {
      __loc = yyloc(_1loc, _2loc);
      __ = [_1].concat(_2);
    }], [20, 4, function(_1, _2, _3, _4, _1loc, _2loc, _3loc, _4loc) {
      __loc = yyloc(_1loc, _4loc);
      checkClassRange(_1, _3);
      __ = [Node({
        type: "ClassRange",
        from: _1,
        to: _3
      }, loc(_1loc, _3loc))];
      if (_4) {
        __ = __.concat(_4);
      }
    }], [21, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Char(_1, "simple", __loc);
    }], [21, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [22, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = _1;
    }], [22, 1, function(_1, _1loc) {
      __loc = yyloc(_1loc, _1loc);
      __ = Char(_1, "meta", __loc);
    }]];
    var tokens = { "SLASH": "23", "CHAR": "24", "BAR": "25", "BOS": "26", "EOS": "27", "ESC_b": "28", "ESC_B": "29", "POS_LA_ASSERT": "30", "R_PAREN": "31", "NEG_LA_ASSERT": "32", "POS_LB_ASSERT": "33", "NEG_LB_ASSERT": "34", "ESC_CHAR": "35", "U_CODE_SURROGATE": "36", "U_CODE": "37", "U_PROP_VALUE_EXP": "38", "CTRL_CH": "39", "HEX_CODE": "40", "OCT_CODE": "41", "DEC_CODE": "42", "META_CHAR": "43", "ANY": "44", "NAMED_GROUP_REF": "45", "Q_MARK": "46", "STAR": "47", "PLUS": "48", "RANGE_EXACT": "49", "RANGE_OPEN": "50", "RANGE_CLOSED": "51", "NAMED_CAPTURE_GROUP": "52", "L_PAREN": "53", "NON_CAPTURE_GROUP": "54", "NEG_CLASS": "55", "R_BRACKET": "56", "L_BRACKET": "57", "DASH": "58", "$": "59" };
    var table = [{ "0": 1, "23": "s2" }, { "59": "acc" }, { "3": 3, "4": 4, "5": 5, "6": 6, "23": "r10", "24": "r10", "25": "r10", "26": "r10", "27": "r10", "28": "r10", "29": "r10", "30": "r10", "32": "r10", "33": "r10", "34": "r10", "35": "r10", "36": "r10", "37": "r10", "38": "r10", "39": "r10", "40": "r10", "41": "r10", "42": "r10", "43": "r10", "44": "r10", "45": "r10", "52": "r10", "53": "r10", "54": "r10", "55": "r10", "57": "r10" }, { "23": "s7" }, { "23": "r6", "25": "s12" }, { "23": "r7", "25": "r7", "31": "r7" }, { "7": 14, "8": 15, "9": 16, "10": 25, "14": 27, "15": 42, "16": 43, "17": 26, "23": "r9", "24": "s28", "25": "r9", "26": "s17", "27": "s18", "28": "s19", "29": "s20", "30": "s21", "31": "r9", "32": "s22", "33": "s23", "34": "s24", "35": "s29", "36": "s30", "37": "s31", "38": "s32", "39": "s33", "40": "s34", "41": "s35", "42": "s36", "43": "s37", "44": "s38", "45": "s39", "52": "s44", "53": "s45", "54": "s46", "55": "s40", "57": "s41" }, { "1": 8, "2": 9, "24": "s10", "59": "r3" }, { "59": "r1" }, { "24": "s11", "59": "r2" }, { "24": "r4", "59": "r4" }, { "24": "r5", "59": "r5" }, { "5": 13, "6": 6, "23": "r10", "24": "r10", "25": "r10", "26": "r10", "27": "r10", "28": "r10", "29": "r10", "30": "r10", "31": "r10", "32": "r10", "33": "r10", "34": "r10", "35": "r10", "36": "r10", "37": "r10", "38": "r10", "39": "r10", "40": "r10", "41": "r10", "42": "r10", "43": "r10", "44": "r10", "45": "r10", "52": "r10", "53": "r10", "54": "r10", "55": "r10", "57": "r10" }, { "23": "r8", "25": "r8", "31": "r8" }, { "23": "r11", "24": "r11", "25": "r11", "26": "r11", "27": "r11", "28": "r11", "29": "r11", "30": "r11", "31": "r11", "32": "r11", "33": "r11", "34": "r11", "35": "r11", "36": "r11", "37": "r11", "38": "r11", "39": "r11", "40": "r11", "41": "r11", "42": "r11", "43": "r11", "44": "r11", "45": "r11", "52": "r11", "53": "r11", "54": "r11", "55": "r11", "57": "r11" }, { "23": "r12", "24": "r12", "25": "r12", "26": "r12", "27": "r12", "28": "r12", "29": "r12", "30": "r12", "31": "r12", "32": "r12", "33": "r12", "34": "r12", "35": "r12", "36": "r12", "37": "r12", "38": "r12", "39": "r12", "40": "r12", "41": "r12", "42": "r12", "43": "r12", "44": "r12", "45": "r12", "52": "r12", "53": "r12", "54": "r12", "55": "r12", "57": "r12" }, { "11": 47, "12": 48, "13": 49, "23": "r38", "24": "r38", "25": "r38", "26": "r38", "27": "r38", "28": "r38", "29": "r38", "30": "r38", "31": "r38", "32": "r38", "33": "r38", "34": "r38", "35": "r38", "36": "r38", "37": "r38", "38": "r38", "39": "r38", "40": "r38", "41": "r38", "42": "r38", "43": "r38", "44": "r38", "45": "r38", "46": "s52", "47": "s50", "48": "s51", "49": "s53", "50": "s54", "51": "s55", "52": "r38", "53": "r38", "54": "r38", "55": "r38", "57": "r38" }, { "23": "r14", "24": "r14", "25": "r14", "26": "r14", "27": "r14", "28": "r14", "29": "r14", "30": "r14", "31": "r14", "32": "r14", "33": "r14", "34": "r14", "35": "r14", "36": "r14", "37": "r14", "38": "r14", "39": "r14", "40": "r14", "41": "r14", "42": "r14", "43": "r14", "44": "r14", "45": "r14", "52": "r14", "53": "r14", "54": "r14", "55": "r14", "57": "r14" }, { "23": "r15", "24": "r15", "25": "r15", "26": "r15", "27": "r15", "28": "r15", "29": "r15", "30": "r15", "31": "r15", "32": "r15", "33": "r15", "34": "r15", "35": "r15", "36": "r15", "37": "r15", "38": "r15", "39": "r15", "40": "r15", "41": "r15", "42": "r15", "43": "r15", "44": "r15", "45": "r15", "52": "r15", "53": "r15", "54": "r15", "55": "r15", "57": "r15" }, { "23": "r16", "24": "r16", "25": "r16", "26": "r16", "27": "r16", "28": "r16", "29": "r16", "30": "r16", "31": "r16", "32": "r16", "33": "r16", "34": "r16", "35": "r16", "36": "r16", "37": "r16", "38": "r16", "39": "r16", "40": "r16", "41": "r16", "42": "r16", "43": "r16", "44": "r16", "45": "r16", "52": "r16", "53": "r16", "54": "r16", "55": "r16", "57": "r16" }, { "23": "r17", "24": "r17", "25": "r17", "26": "r17", "27": "r17", "28": "r17", "29": "r17", "30": "r17", "31": "r17", "32": "r17", "33": "r17", "34": "r17", "35": "r17", "36": "r17", "37": "r17", "38": "r17", "39": "r17", "40": "r17", "41": "r17", "42": "r17", "43": "r17", "44": "r17", "45": "r17", "52": "r17", "53": "r17", "54": "r17", "55": "r17", "57": "r17" }, { "4": 57, "5": 5, "6": 6, "24": "r10", "25": "r10", "26": "r10", "27": "r10", "28": "r10", "29": "r10", "30": "r10", "31": "r10", "32": "r10", "33": "r10", "34": "r10", "35": "r10", "36": "r10", "37": "r10", "38": "r10", "39": "r10", "40": "r10", "41": "r10", "42": "r10", "43": "r10", "44": "r10", "45": "r10", "52": "r10", "53": "r10", "54": "r10", "55": "r10", "57": "r10" }, { "4": 59, "5": 5, "6": 6, "24": "r10", "25": "r10", "26": "r10", "27": "r10", "28": "r10", "29": "r10", "30": "r10", "31": "r10", "32": "r10", "33": "r10", "34": "r10", "35": "r10", "36": "r10", "37": "r10", "38": "r10", "39": "r10", "40": "r10", "41": "r10", "42": "r10", "43": "r10", "44": "r10", "45": "r10", "52": "r10", "53": "r10", "54": "r10", "55": "r10", "57": "r10" }, { "4": 61, "5": 5, "6": 6, "24": "r10", "25": "r10", "26": "r10", "27": "r10", "28": "r10", "29": "r10", "30": "r10", "31": "r10", "32": "r10", "33": "r10", "34": "r10", "35": "r10", "36": "r10", "37": "r10", "38": "r10", "39": "r10", "40": "r10", "41": "r10", "42": "r10", "43": "r10", "44": "r10", "45": "r10", "52": "r10", "53": "r10", "54": "r10", "55": "r10", "57": "r10" }, { "4": 63, "5": 5, "6": 6, "24": "r10", "25": "r10", "26": "r10", "27": "r10", "28": "r10", "29": "r10", "30": "r10", "31": "r10", "32": "r10", "33": "r10", "34": "r10", "35": "r10", "36": "r10", "37": "r10", "38": "r10", "39": "r10", "40": "r10", "41": "r10", "42": "r10", "43": "r10", "44": "r10", "45": "r10", "52": "r10", "53": "r10", "54": "r10", "55": "r10", "57": "r10" }, { "23": "r22", "24": "r22", "25": "r22", "26": "r22", "27": "r22", "28": "r22", "29": "r22", "30": "r22", "31": "r22", "32": "r22", "33": "r22", "34": "r22", "35": "r22", "36": "r22", "37": "r22", "38": "r22", "39": "r22", "40": "r22", "41": "r22", "42": "r22", "43": "r22", "44": "r22", "45": "r22", "46": "r22", "47": "r22", "48": "r22", "49": "r22", "50": "r22", "51": "r22", "52": "r22", "53": "r22", "54": "r22", "55": "r22", "57": "r22" }, { "23": "r23", "24": "r23", "25": "r23", "26": "r23", "27": "r23", "28": "r23", "29": "r23", "30": "r23", "31": "r23", "32": "r23", "33": "r23", "34": "r23", "35": "r23", "36": "r23", "37": "r23", "38": "r23", "39": "r23", "40": "r23", "41": "r23", "42": "r23", "43": "r23", "44": "r23", "45": "r23", "46": "r23", "47": "r23", "48": "r23", "49": "r23", "50": "r23", "51": "r23", "52": "r23", "53": "r23", "54": "r23", "55": "r23", "57": "r23" }, { "23": "r24", "24": "r24", "25": "r24", "26": "r24", "27": "r24", "28": "r24", "29": "r24", "30": "r24", "31": "r24", "32": "r24", "33": "r24", "34": "r24", "35": "r24", "36": "r24", "37": "r24", "38": "r24", "39": "r24", "40": "r24", "41": "r24", "42": "r24", "43": "r24", "44": "r24", "45": "r24", "46": "r24", "47": "r24", "48": "r24", "49": "r24", "50": "r24", "51": "r24", "52": "r24", "53": "r24", "54": "r24", "55": "r24", "57": "r24" }, { "23": "r25", "24": "r25", "25": "r25", "26": "r25", "27": "r25", "28": "r25", "29": "r25", "30": "r25", "31": "r25", "32": "r25", "33": "r25", "34": "r25", "35": "r25", "36": "r25", "37": "r25", "38": "r25", "39": "r25", "40": "r25", "41": "r25", "42": "r25", "43": "r25", "44": "r25", "45": "r25", "46": "r25", "47": "r25", "48": "r25", "49": "r25", "50": "r25", "51": "r25", "52": "r25", "53": "r25", "54": "r25", "55": "r25", "56": "r25", "57": "r25", "58": "r25" }, { "23": "r26", "24": "r26", "25": "r26", "26": "r26", "27": "r26", "28": "r26", "29": "r26", "30": "r26", "31": "r26", "32": "r26", "33": "r26", "34": "r26", "35": "r26", "36": "r26", "37": "r26", "38": "r26", "39": "r26", "40": "r26", "41": "r26", "42": "r26", "43": "r26", "44": "r26", "45": "r26", "46": "r26", "47": "r26", "48": "r26", "49": "r26", "50": "r26", "51": "r26", "52": "r26", "53": "r26", "54": "r26", "55": "r26", "56": "r26", "57": "r26", "58": "r26" }, { "23": "r27", "24": "r27", "25": "r27", "26": "r27", "27": "r27", "28": "r27", "29": "r27", "30": "r27", "31": "r27", "32": "r27", "33": "r27", "34": "r27", "35": "r27", "36": "r27", "37": "r27", "38": "r27", "39": "r27", "40": "r27", "41": "r27", "42": "r27", "43": "r27", "44": "r27", "45": "r27", "46": "r27", "47": "r27", "48": "r27", "49": "r27", "50": "r27", "51": "r27", "52": "r27", "53": "r27", "54": "r27", "55": "r27", "56": "r27", "57": "r27", "58": "r27" }, { "23": "r28", "24": "r28", "25": "r28", "26": "r28", "27": "r28", "28": "r28", "29": "r28", "30": "r28", "31": "r28", "32": "r28", "33": "r28", "34": "r28", "35": "r28", "36": "r28", "37": "r28", "38": "r28", "39": "r28", "40": "r28", "41": "r28", "42": "r28", "43": "r28", "44": "r28", "45": "r28", "46": "r28", "47": "r28", "48": "r28", "49": "r28", "50": "r28", "51": "r28", "52": "r28", "53": "r28", "54": "r28", "55": "r28", "56": "r28", "57": "r28", "58": "r28" }, { "23": "r29", "24": "r29", "25": "r29", "26": "r29", "27": "r29", "28": "r29", "29": "r29", "30": "r29", "31": "r29", "32": "r29", "33": "r29", "34": "r29", "35": "r29", "36": "r29", "37": "r29", "38": "r29", "39": "r29", "40": "r29", "41": "r29", "42": "r29", "43": "r29", "44": "r29", "45": "r29", "46": "r29", "47": "r29", "48": "r29", "49": "r29", "50": "r29", "51": "r29", "52": "r29", "53": "r29", "54": "r29", "55": "r29", "56": "r29", "57": "r29", "58": "r29" }, { "23": "r30", "24": "r30", "25": "r30", "26": "r30", "27": "r30", "28": "r30", "29": "r30", "30": "r30", "31": "r30", "32": "r30", "33": "r30", "34": "r30", "35": "r30", "36": "r30", "37": "r30", "38": "r30", "39": "r30", "40": "r30", "41": "r30", "42": "r30", "43": "r30", "44": "r30", "45": "r30", "46": "r30", "47": "r30", "48": "r30", "49": "r30", "50": "r30", "51": "r30", "52": "r30", "53": "r30", "54": "r30", "55": "r30", "56": "r30", "57": "r30", "58": "r30" }, { "23": "r31", "24": "r31", "25": "r31", "26": "r31", "27": "r31", "28": "r31", "29": "r31", "30": "r31", "31": "r31", "32": "r31", "33": "r31", "34": "r31", "35": "r31", "36": "r31", "37": "r31", "38": "r31", "39": "r31", "40": "r31", "41": "r31", "42": "r31", "43": "r31", "44": "r31", "45": "r31", "46": "r31", "47": "r31", "48": "r31", "49": "r31", "50": "r31", "51": "r31", "52": "r31", "53": "r31", "54": "r31", "55": "r31", "56": "r31", "57": "r31", "58": "r31" }, { "23": "r32", "24": "r32", "25": "r32", "26": "r32", "27": "r32", "28": "r32", "29": "r32", "30": "r32", "31": "r32", "32": "r32", "33": "r32", "34": "r32", "35": "r32", "36": "r32", "37": "r32", "38": "r32", "39": "r32", "40": "r32", "41": "r32", "42": "r32", "43": "r32", "44": "r32", "45": "r32", "46": "r32", "47": "r32", "48": "r32", "49": "r32", "50": "r32", "51": "r32", "52": "r32", "53": "r32", "54": "r32", "55": "r32", "56": "r32", "57": "r32", "58": "r32" }, { "23": "r33", "24": "r33", "25": "r33", "26": "r33", "27": "r33", "28": "r33", "29": "r33", "30": "r33", "31": "r33", "32": "r33", "33": "r33", "34": "r33", "35": "r33", "36": "r33", "37": "r33", "38": "r33", "39": "r33", "40": "r33", "41": "r33", "42": "r33", "43": "r33", "44": "r33", "45": "r33", "46": "r33", "47": "r33", "48": "r33", "49": "r33", "50": "r33", "51": "r33", "52": "r33", "53": "r33", "54": "r33", "55": "r33", "56": "r33", "57": "r33", "58": "r33" }, { "23": "r34", "24": "r34", "25": "r34", "26": "r34", "27": "r34", "28": "r34", "29": "r34", "30": "r34", "31": "r34", "32": "r34", "33": "r34", "34": "r34", "35": "r34", "36": "r34", "37": "r34", "38": "r34", "39": "r34", "40": "r34", "41": "r34", "42": "r34", "43": "r34", "44": "r34", "45": "r34", "46": "r34", "47": "r34", "48": "r34", "49": "r34", "50": "r34", "51": "r34", "52": "r34", "53": "r34", "54": "r34", "55": "r34", "56": "r34", "57": "r34", "58": "r34" }, { "23": "r35", "24": "r35", "25": "r35", "26": "r35", "27": "r35", "28": "r35", "29": "r35", "30": "r35", "31": "r35", "32": "r35", "33": "r35", "34": "r35", "35": "r35", "36": "r35", "37": "r35", "38": "r35", "39": "r35", "40": "r35", "41": "r35", "42": "r35", "43": "r35", "44": "r35", "45": "r35", "46": "r35", "47": "r35", "48": "r35", "49": "r35", "50": "r35", "51": "r35", "52": "r35", "53": "r35", "54": "r35", "55": "r35", "56": "r35", "57": "r35", "58": "r35" }, { "23": "r36", "24": "r36", "25": "r36", "26": "r36", "27": "r36", "28": "r36", "29": "r36", "30": "r36", "31": "r36", "32": "r36", "33": "r36", "34": "r36", "35": "r36", "36": "r36", "37": "r36", "38": "r36", "39": "r36", "40": "r36", "41": "r36", "42": "r36", "43": "r36", "44": "r36", "45": "r36", "46": "r36", "47": "r36", "48": "r36", "49": "r36", "50": "r36", "51": "r36", "52": "r36", "53": "r36", "54": "r36", "55": "r36", "56": "r36", "57": "r36", "58": "r36" }, { "10": 70, "18": 65, "19": 66, "21": 67, "22": 69, "24": "s28", "28": "s71", "35": "s29", "36": "s30", "37": "s31", "38": "s32", "39": "s33", "40": "s34", "41": "s35", "42": "s36", "43": "s37", "44": "s38", "45": "s39", "56": "r54", "58": "s68" }, { "10": 70, "18": 83, "19": 66, "21": 67, "22": 69, "24": "s28", "28": "s71", "35": "s29", "36": "s30", "37": "s31", "38": "s32", "39": "s33", "40": "s34", "41": "s35", "42": "s36", "43": "s37", "44": "s38", "45": "s39", "56": "r54", "58": "s68" }, { "23": "r47", "24": "r47", "25": "r47", "26": "r47", "27": "r47", "28": "r47", "29": "r47", "30": "r47", "31": "r47", "32": "r47", "33": "r47", "34": "r47", "35": "r47", "36": "r47", "37": "r47", "38": "r47", "39": "r47", "40": "r47", "41": "r47", "42": "r47", "43": "r47", "44": "r47", "45": "r47", "46": "r47", "47": "r47", "48": "r47", "49": "r47", "50": "r47", "51": "r47", "52": "r47", "53": "r47", "54": "r47", "55": "r47", "57": "r47" }, { "23": "r48", "24": "r48", "25": "r48", "26": "r48", "27": "r48", "28": "r48", "29": "r48", "30": "r48", "31": "r48", "32": "r48", "33": "r48", "34": "r48", "35": "r48", "36": "r48", "37": "r48", "38": "r48", "39": "r48", "40": "r48", "41": "r48", "42": "r48", "43": "r48", "44": "r48", "45": "r48", "46": "r48", "47": "r48", "48": "r48", "49": "r48", "50": "r48", "51": "r48", "52": "r48", "53": "r48", "54": "r48", "55": "r48", "57": "r48" }, { "4": 85, "5": 5, "6": 6, "24": "r10", "25": "r10", "26": "r10", "27": "r10", "28": "r10", "29": "r10", "30": "r10", "31": "r10", "32": "r10", "33": "r10", "34": "r10", "35": "r10", "36": "r10", "37": "r10", "38": "r10", "39": "r10", "40": "r10", "41": "r10", "42": "r10", "43": "r10", "44": "r10", "45": "r10", "52": "r10", "53": "r10", "54": "r10", "55": "r10", "57": "r10" }, { "4": 87, "5": 5, "6": 6, "24": "r10", "25": "r10", "26": "r10", "27": "r10", "28": "r10", "29": "r10", "30": "r10", "31": "r10", "32": "r10", "33": "r10", "34": "r10", "35": "r10", "36": "r10", "37": "r10", "38": "r10", "39": "r10", "40": "r10", "41": "r10", "42": "r10", "43": "r10", "44": "r10", "45": "r10", "52": "r10", "53": "r10", "54": "r10", "55": "r10", "57": "r10" }, { "4": 89, "5": 5, "6": 6, "24": "r10", "25": "r10", "26": "r10", "27": "r10", "28": "r10", "29": "r10", "30": "r10", "31": "r10", "32": "r10", "33": "r10", "34": "r10", "35": "r10", "36": "r10", "37": "r10", "38": "r10", "39": "r10", "40": "r10", "41": "r10", "42": "r10", "43": "r10", "44": "r10", "45": "r10", "52": "r10", "53": "r10", "54": "r10", "55": "r10", "57": "r10" }, { "23": "r13", "24": "r13", "25": "r13", "26": "r13", "27": "r13", "28": "r13", "29": "r13", "30": "r13", "31": "r13", "32": "r13", "33": "r13", "34": "r13", "35": "r13", "36": "r13", "37": "r13", "38": "r13", "39": "r13", "40": "r13", "41": "r13", "42": "r13", "43": "r13", "44": "r13", "45": "r13", "52": "r13", "53": "r13", "54": "r13", "55": "r13", "57": "r13" }, { "23": "r37", "24": "r37", "25": "r37", "26": "r37", "27": "r37", "28": "r37", "29": "r37", "30": "r37", "31": "r37", "32": "r37", "33": "r37", "34": "r37", "35": "r37", "36": "r37", "37": "r37", "38": "r37", "39": "r37", "40": "r37", "41": "r37", "42": "r37", "43": "r37", "44": "r37", "45": "r37", "52": "r37", "53": "r37", "54": "r37", "55": "r37", "57": "r37" }, { "23": "r39", "24": "r39", "25": "r39", "26": "r39", "27": "r39", "28": "r39", "29": "r39", "30": "r39", "31": "r39", "32": "r39", "33": "r39", "34": "r39", "35": "r39", "36": "r39", "37": "r39", "38": "r39", "39": "r39", "40": "r39", "41": "r39", "42": "r39", "43": "r39", "44": "r39", "45": "r39", "46": "s56", "52": "r39", "53": "r39", "54": "r39", "55": "r39", "57": "r39" }, { "23": "r41", "24": "r41", "25": "r41", "26": "r41", "27": "r41", "28": "r41", "29": "r41", "30": "r41", "31": "r41", "32": "r41", "33": "r41", "34": "r41", "35": "r41", "36": "r41", "37": "r41", "38": "r41", "39": "r41", "40": "r41", "41": "r41", "42": "r41", "43": "r41", "44": "r41", "45": "r41", "46": "r41", "52": "r41", "53": "r41", "54": "r41", "55": "r41", "57": "r41" }, { "23": "r42", "24": "r42", "25": "r42", "26": "r42", "27": "r42", "28": "r42", "29": "r42", "30": "r42", "31": "r42", "32": "r42", "33": "r42", "34": "r42", "35": "r42", "36": "r42", "37": "r42", "38": "r42", "39": "r42", "40": "r42", "41": "r42", "42": "r42", "43": "r42", "44": "r42", "45": "r42", "46": "r42", "52": "r42", "53": "r42", "54": "r42", "55": "r42", "57": "r42" }, { "23": "r43", "24": "r43", "25": "r43", "26": "r43", "27": "r43", "28": "r43", "29": "r43", "30": "r43", "31": "r43", "32": "r43", "33": "r43", "34": "r43", "35": "r43", "36": "r43", "37": "r43", "38": "r43", "39": "r43", "40": "r43", "41": "r43", "42": "r43", "43": "r43", "44": "r43", "45": "r43", "46": "r43", "52": "r43", "53": "r43", "54": "r43", "55": "r43", "57": "r43" }, { "23": "r44", "24": "r44", "25": "r44", "26": "r44", "27": "r44", "28": "r44", "29": "r44", "30": "r44", "31": "r44", "32": "r44", "33": "r44", "34": "r44", "35": "r44", "36": "r44", "37": "r44", "38": "r44", "39": "r44", "40": "r44", "41": "r44", "42": "r44", "43": "r44", "44": "r44", "45": "r44", "46": "r44", "52": "r44", "53": "r44", "54": "r44", "55": "r44", "57": "r44" }, { "23": "r45", "24": "r45", "25": "r45", "26": "r45", "27": "r45", "28": "r45", "29": "r45", "30": "r45", "31": "r45", "32": "r45", "33": "r45", "34": "r45", "35": "r45", "36": "r45", "37": "r45", "38": "r45", "39": "r45", "40": "r45", "41": "r45", "42": "r45", "43": "r45", "44": "r45", "45": "r45", "46": "r45", "52": "r45", "53": "r45", "54": "r45", "55": "r45", "57": "r45" }, { "23": "r46", "24": "r46", "25": "r46", "26": "r46", "27": "r46", "28": "r46", "29": "r46", "30": "r46", "31": "r46", "32": "r46", "33": "r46", "34": "r46", "35": "r46", "36": "r46", "37": "r46", "38": "r46", "39": "r46", "40": "r46", "41": "r46", "42": "r46", "43": "r46", "44": "r46", "45": "r46", "46": "r46", "52": "r46", "53": "r46", "54": "r46", "55": "r46", "57": "r46" }, { "23": "r40", "24": "r40", "25": "r40", "26": "r40", "27": "r40", "28": "r40", "29": "r40", "30": "r40", "31": "r40", "32": "r40", "33": "r40", "34": "r40", "35": "r40", "36": "r40", "37": "r40", "38": "r40", "39": "r40", "40": "r40", "41": "r40", "42": "r40", "43": "r40", "44": "r40", "45": "r40", "52": "r40", "53": "r40", "54": "r40", "55": "r40", "57": "r40" }, { "25": "s12", "31": "s58" }, { "23": "r18", "24": "r18", "25": "r18", "26": "r18", "27": "r18", "28": "r18", "29": "r18", "30": "r18", "31": "r18", "32": "r18", "33": "r18", "34": "r18", "35": "r18", "36": "r18", "37": "r18", "38": "r18", "39": "r18", "40": "r18", "41": "r18", "42": "r18", "43": "r18", "44": "r18", "45": "r18", "52": "r18", "53": "r18", "54": "r18", "55": "r18", "57": "r18" }, { "25": "s12", "31": "s60" }, { "23": "r19", "24": "r19", "25": "r19", "26": "r19", "27": "r19", "28": "r19", "29": "r19", "30": "r19", "31": "r19", "32": "r19", "33": "r19", "34": "r19", "35": "r19", "36": "r19", "37": "r19", "38": "r19", "39": "r19", "40": "r19", "41": "r19", "42": "r19", "43": "r19", "44": "r19", "45": "r19", "52": "r19", "53": "r19", "54": "r19", "55": "r19", "57": "r19" }, { "25": "s12", "31": "s62" }, { "23": "r20", "24": "r20", "25": "r20", "26": "r20", "27": "r20", "28": "r20", "29": "r20", "30": "r20", "31": "r20", "32": "r20", "33": "r20", "34": "r20", "35": "r20", "36": "r20", "37": "r20", "38": "r20", "39": "r20", "40": "r20", "41": "r20", "42": "r20", "43": "r20", "44": "r20", "45": "r20", "52": "r20", "53": "r20", "54": "r20", "55": "r20", "57": "r20" }, { "25": "s12", "31": "s64" }, { "23": "r21", "24": "r21", "25": "r21", "26": "r21", "27": "r21", "28": "r21", "29": "r21", "30": "r21", "31": "r21", "32": "r21", "33": "r21", "34": "r21", "35": "r21", "36": "r21", "37": "r21", "38": "r21", "39": "r21", "40": "r21", "41": "r21", "42": "r21", "43": "r21", "44": "r21", "45": "r21", "52": "r21", "53": "r21", "54": "r21", "55": "r21", "57": "r21" }, { "56": "s72" }, { "56": "r55" }, { "10": 70, "20": 73, "21": 75, "22": 76, "24": "s28", "28": "s71", "35": "s29", "36": "s30", "37": "s31", "38": "s32", "39": "s33", "40": "s34", "41": "s35", "42": "s36", "43": "s37", "44": "s38", "45": "s39", "56": "r56", "58": "s74" }, { "24": "r62", "28": "r62", "35": "r62", "36": "r62", "37": "r62", "38": "r62", "39": "r62", "40": "r62", "41": "r62", "42": "r62", "43": "r62", "44": "r62", "45": "r62", "56": "r62", "58": "r62" }, { "24": "r63", "28": "r63", "35": "r63", "36": "r63", "37": "r63", "38": "r63", "39": "r63", "40": "r63", "41": "r63", "42": "r63", "43": "r63", "44": "r63", "45": "r63", "56": "r63", "58": "r63" }, { "24": "r64", "28": "r64", "35": "r64", "36": "r64", "37": "r64", "38": "r64", "39": "r64", "40": "r64", "41": "r64", "42": "r64", "43": "r64", "44": "r64", "45": "r64", "56": "r64", "58": "r64" }, { "24": "r65", "28": "r65", "35": "r65", "36": "r65", "37": "r65", "38": "r65", "39": "r65", "40": "r65", "41": "r65", "42": "r65", "43": "r65", "44": "r65", "45": "r65", "56": "r65", "58": "r65" }, { "23": "r52", "24": "r52", "25": "r52", "26": "r52", "27": "r52", "28": "r52", "29": "r52", "30": "r52", "31": "r52", "32": "r52", "33": "r52", "34": "r52", "35": "r52", "36": "r52", "37": "r52", "38": "r52", "39": "r52", "40": "r52", "41": "r52", "42": "r52", "43": "r52", "44": "r52", "45": "r52", "46": "r52", "47": "r52", "48": "r52", "49": "r52", "50": "r52", "51": "r52", "52": "r52", "53": "r52", "54": "r52", "55": "r52", "57": "r52" }, { "56": "r57" }, { "10": 70, "21": 77, "22": 69, "24": "s28", "28": "s71", "35": "s29", "36": "s30", "37": "s31", "38": "s32", "39": "s33", "40": "s34", "41": "s35", "42": "s36", "43": "s37", "44": "s38", "45": "s39", "56": "r62", "58": "s68" }, { "56": "r59" }, { "10": 70, "20": 79, "21": 75, "22": 76, "24": "s28", "28": "s71", "35": "s29", "36": "s30", "37": "s31", "38": "s32", "39": "s33", "40": "s34", "41": "s35", "42": "s36", "43": "s37", "44": "s38", "45": "s39", "56": "r63", "58": "s80" }, { "10": 70, "18": 78, "19": 66, "21": 67, "22": 69, "24": "s28", "28": "s71", "35": "s29", "36": "s30", "37": "s31", "38": "s32", "39": "s33", "40": "s34", "41": "s35", "42": "s36", "43": "s37", "44": "s38", "45": "s39", "56": "r54", "58": "s68" }, { "56": "r58" }, { "56": "r60" }, { "10": 70, "21": 81, "22": 69, "24": "s28", "28": "s71", "35": "s29", "36": "s30", "37": "s31", "38": "s32", "39": "s33", "40": "s34", "41": "s35", "42": "s36", "43": "s37", "44": "s38", "45": "s39", "56": "r62", "58": "s68" }, { "10": 70, "18": 82, "19": 66, "21": 67, "22": 69, "24": "s28", "28": "s71", "35": "s29", "36": "s30", "37": "s31", "38": "s32", "39": "s33", "40": "s34", "41": "s35", "42": "s36", "43": "s37", "44": "s38", "45": "s39", "56": "r54", "58": "s68" }, { "56": "r61" }, { "56": "s84" }, { "23": "r53", "24": "r53", "25": "r53", "26": "r53", "27": "r53", "28": "r53", "29": "r53", "30": "r53", "31": "r53", "32": "r53", "33": "r53", "34": "r53", "35": "r53", "36": "r53", "37": "r53", "38": "r53", "39": "r53", "40": "r53", "41": "r53", "42": "r53", "43": "r53", "44": "r53", "45": "r53", "46": "r53", "47": "r53", "48": "r53", "49": "r53", "50": "r53", "51": "r53", "52": "r53", "53": "r53", "54": "r53", "55": "r53", "57": "r53" }, { "25": "s12", "31": "s86" }, { "23": "r49", "24": "r49", "25": "r49", "26": "r49", "27": "r49", "28": "r49", "29": "r49", "30": "r49", "31": "r49", "32": "r49", "33": "r49", "34": "r49", "35": "r49", "36": "r49", "37": "r49", "38": "r49", "39": "r49", "40": "r49", "41": "r49", "42": "r49", "43": "r49", "44": "r49", "45": "r49", "46": "r49", "47": "r49", "48": "r49", "49": "r49", "50": "r49", "51": "r49", "52": "r49", "53": "r49", "54": "r49", "55": "r49", "57": "r49" }, { "25": "s12", "31": "s88" }, { "23": "r50", "24": "r50", "25": "r50", "26": "r50", "27": "r50", "28": "r50", "29": "r50", "30": "r50", "31": "r50", "32": "r50", "33": "r50", "34": "r50", "35": "r50", "36": "r50", "37": "r50", "38": "r50", "39": "r50", "40": "r50", "41": "r50", "42": "r50", "43": "r50", "44": "r50", "45": "r50", "46": "r50", "47": "r50", "48": "r50", "49": "r50", "50": "r50", "51": "r50", "52": "r50", "53": "r50", "54": "r50", "55": "r50", "57": "r50" }, { "25": "s12", "31": "s90" }, { "23": "r51", "24": "r51", "25": "r51", "26": "r51", "27": "r51", "28": "r51", "29": "r51", "30": "r51", "31": "r51", "32": "r51", "33": "r51", "34": "r51", "35": "r51", "36": "r51", "37": "r51", "38": "r51", "39": "r51", "40": "r51", "41": "r51", "42": "r51", "43": "r51", "44": "r51", "45": "r51", "46": "r51", "47": "r51", "48": "r51", "49": "r51", "50": "r51", "51": "r51", "52": "r51", "53": "r51", "54": "r51", "55": "r51", "57": "r51" }];
    var stack = [];
    var tokenizer = void 0;
    var lexRules = [[/^#[^\n]+/, function() {
    }], [/^\s+/, function() {
    }], [/^-/, function() {
      return "DASH";
    }], [/^\//, function() {
      return "CHAR";
    }], [/^#/, function() {
      return "CHAR";
    }], [/^\|/, function() {
      return "CHAR";
    }], [/^\./, function() {
      return "CHAR";
    }], [/^\{/, function() {
      return "CHAR";
    }], [/^\{\d+\}/, function() {
      return "RANGE_EXACT";
    }], [/^\{\d+,\}/, function() {
      return "RANGE_OPEN";
    }], [/^\{\d+,\d+\}/, function() {
      return "RANGE_CLOSED";
    }], [/^\\k<(([\u0041-\u005a\u0061-\u007a\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0560-\u0588\u05d0-\u05ea\u05ef-\u05f2\u0620-\u064a\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4-\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u0860-\u086a\u08a0-\u08b4\u08b6-\u08bd\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09f0-\u09f1\u09fc\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0af9\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c60-\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0cf1-\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e81-\u0e82\u0e84\u0e86-\u0e8a\u0e8c-\u0ea3\u0ea5\u0ea7-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f8\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1878\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae-\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1c90-\u1cba\u1cbd-\u1cbf\u1ce9-\u1cec\u1cee-\u1cf3\u1cf5-\u1cf6\u1cfa\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2118-\u211d\u2124\u2126\u2128\u212a-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309b-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312f\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fef\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a-\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua7bf\ua7c2-\ua7c6\ua7f7-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd-\ua8fe\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5-\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab67\uab70-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]|\ud800[\udc00-\udc0b\udc0d-\udc26\udc28-\udc3a\udc3c-\udc3d\udc3f-\udc4d\udc50-\udc5d\udc80-\udcfa\udd40-\udd74\ude80-\ude9c\udea0-\uded0\udf00-\udf1f\udf2d-\udf4a\udf50-\udf75\udf80-\udf9d\udfa0-\udfc3\udfc8-\udfcf\udfd1-\udfd5]|\ud801[\udc00-\udc9d\udcb0-\udcd3\udcd8-\udcfb\udd00-\udd27\udd30-\udd63\ude00-\udf36\udf40-\udf55\udf60-\udf67]|\ud802[\udc00-\udc05\udc08\udc0a-\udc35\udc37-\udc38\udc3c\udc3f-\udc55\udc60-\udc76\udc80-\udc9e\udce0-\udcf2\udcf4-\udcf5\udd00-\udd15\udd20-\udd39\udd80-\uddb7\uddbe-\uddbf\ude00\ude10-\ude13\ude15-\ude17\ude19-\ude35\ude60-\ude7c\ude80-\ude9c\udec0-\udec7\udec9-\udee4\udf00-\udf35\udf40-\udf55\udf60-\udf72\udf80-\udf91]|\ud803[\udc00-\udc48\udc80-\udcb2\udcc0-\udcf2\udd00-\udd23\udf00-\udf1c\udf27\udf30-\udf45\udfe0-\udff6]|\ud804[\udc03-\udc37\udc83-\udcaf\udcd0-\udce8\udd03-\udd26\udd44\udd50-\udd72\udd76\udd83-\uddb2\uddc1-\uddc4\uddda\udddc\ude00-\ude11\ude13-\ude2b\ude80-\ude86\ude88\ude8a-\ude8d\ude8f-\ude9d\ude9f-\udea8\udeb0-\udede\udf05-\udf0c\udf0f-\udf10\udf13-\udf28\udf2a-\udf30\udf32-\udf33\udf35-\udf39\udf3d\udf50\udf5d-\udf61]|\ud805[\udc00-\udc34\udc47-\udc4a\udc5f\udc80-\udcaf\udcc4-\udcc5\udcc7\udd80-\uddae\uddd8-\udddb\ude00-\ude2f\ude44\ude80-\udeaa\udeb8\udf00-\udf1a]|\ud806[\udc00-\udc2b\udca0-\udcdf\udcff\udda0-\udda7\uddaa-\uddd0\udde1\udde3\ude00\ude0b-\ude32\ude3a\ude50\ude5c-\ude89\ude9d\udec0-\udef8]|\ud807[\udc00-\udc08\udc0a-\udc2e\udc40\udc72-\udc8f\udd00-\udd06\udd08-\udd09\udd0b-\udd30\udd46\udd60-\udd65\udd67-\udd68\udd6a-\udd89\udd98\udee0-\udef2]|\ud808[\udc00-\udf99]|\ud809[\udc00-\udc6e\udc80-\udd43]|\ud80c[\udc00-\udfff]|\ud80d[\udc00-\udc2e]|\ud811[\udc00-\ude46]|\ud81a[\udc00-\ude38\ude40-\ude5e\uded0-\udeed\udf00-\udf2f\udf40-\udf43\udf63-\udf77\udf7d-\udf8f]|\ud81b[\ude40-\ude7f\udf00-\udf4a\udf50\udf93-\udf9f\udfe0-\udfe1\udfe3]|\ud81c[\udc00-\udfff]|\ud81d[\udc00-\udfff]|\ud81e[\udc00-\udfff]|\ud81f[\udc00-\udfff]|\ud820[\udc00-\udfff]|\ud821[\udc00-\udff7]|\ud822[\udc00-\udef2]|\ud82c[\udc00-\udd1e\udd50-\udd52\udd64-\udd67\udd70-\udefb]|\ud82f[\udc00-\udc6a\udc70-\udc7c\udc80-\udc88\udc90-\udc99]|\ud835[\udc00-\udc54\udc56-\udc9c\udc9e-\udc9f\udca2\udca5-\udca6\udca9-\udcac\udcae-\udcb9\udcbb\udcbd-\udcc3\udcc5-\udd05\udd07-\udd0a\udd0d-\udd14\udd16-\udd1c\udd1e-\udd39\udd3b-\udd3e\udd40-\udd44\udd46\udd4a-\udd50\udd52-\udea5\udea8-\udec0\udec2-\udeda\udedc-\udefa\udefc-\udf14\udf16-\udf34\udf36-\udf4e\udf50-\udf6e\udf70-\udf88\udf8a-\udfa8\udfaa-\udfc2\udfc4-\udfcb]|\ud838[\udd00-\udd2c\udd37-\udd3d\udd4e\udec0-\udeeb]|\ud83a[\udc00-\udcc4\udd00-\udd43\udd4b]|\ud83b[\ude00-\ude03\ude05-\ude1f\ude21-\ude22\ude24\ude27\ude29-\ude32\ude34-\ude37\ude39\ude3b\ude42\ude47\ude49\ude4b\ude4d-\ude4f\ude51-\ude52\ude54\ude57\ude59\ude5b\ude5d\ude5f\ude61-\ude62\ude64\ude67-\ude6a\ude6c-\ude72\ude74-\ude77\ude79-\ude7c\ude7e\ude80-\ude89\ude8b-\ude9b\udea1-\udea3\udea5-\udea9\udeab-\udebb]|\ud840[\udc00-\udfff]|\ud841[\udc00-\udfff]|\ud842[\udc00-\udfff]|\ud843[\udc00-\udfff]|\ud844[\udc00-\udfff]|\ud845[\udc00-\udfff]|\ud846[\udc00-\udfff]|\ud847[\udc00-\udfff]|\ud848[\udc00-\udfff]|\ud849[\udc00-\udfff]|\ud84a[\udc00-\udfff]|\ud84b[\udc00-\udfff]|\ud84c[\udc00-\udfff]|\ud84d[\udc00-\udfff]|\ud84e[\udc00-\udfff]|\ud84f[\udc00-\udfff]|\ud850[\udc00-\udfff]|\ud851[\udc00-\udfff]|\ud852[\udc00-\udfff]|\ud853[\udc00-\udfff]|\ud854[\udc00-\udfff]|\ud855[\udc00-\udfff]|\ud856[\udc00-\udfff]|\ud857[\udc00-\udfff]|\ud858[\udc00-\udfff]|\ud859[\udc00-\udfff]|\ud85a[\udc00-\udfff]|\ud85b[\udc00-\udfff]|\ud85c[\udc00-\udfff]|\ud85d[\udc00-\udfff]|\ud85e[\udc00-\udfff]|\ud85f[\udc00-\udfff]|\ud860[\udc00-\udfff]|\ud861[\udc00-\udfff]|\ud862[\udc00-\udfff]|\ud863[\udc00-\udfff]|\ud864[\udc00-\udfff]|\ud865[\udc00-\udfff]|\ud866[\udc00-\udfff]|\ud867[\udc00-\udfff]|\ud868[\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|\ud86a[\udc00-\udfff]|\ud86b[\udc00-\udfff]|\ud86c[\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d\udc20-\udfff]|\ud86f[\udc00-\udfff]|\ud870[\udc00-\udfff]|\ud871[\udc00-\udfff]|\ud872[\udc00-\udfff]|\ud873[\udc00-\udea1\udeb0-\udfff]|\ud874[\udc00-\udfff]|\ud875[\udc00-\udfff]|\ud876[\udc00-\udfff]|\ud877[\udc00-\udfff]|\ud878[\udc00-\udfff]|\ud879[\udc00-\udfff]|\ud87a[\udc00-\udfe0]|\ud87e[\udc00-\ude1d])|[$_]|(\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]{1,}\}))(([\u0030-\u0039\u0041-\u005a\u005f\u0061-\u007a\u00aa\u00b5\u00b7\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0300-\u0374\u0376-\u0377\u037a-\u037d\u037f\u0386-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u0483-\u0487\u048a-\u052f\u0531-\u0556\u0559\u0560-\u0588\u0591-\u05bd\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05c7\u05d0-\u05ea\u05ef-\u05f2\u0610-\u061a\u0620-\u0669\u066e-\u06d3\u06d5-\u06dc\u06df-\u06e8\u06ea-\u06fc\u06ff\u0710-\u074a\u074d-\u07b1\u07c0-\u07f5\u07fa\u07fd\u0800-\u082d\u0840-\u085b\u0860-\u086a\u08a0-\u08b4\u08b6-\u08bd\u08d3-\u08e1\u08e3-\u0963\u0966-\u096f\u0971-\u0983\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bc-\u09c4\u09c7-\u09c8\u09cb-\u09ce\u09d7\u09dc-\u09dd\u09df-\u09e3\u09e6-\u09f1\u09fc\u09fe\u0a01-\u0a03\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a3c\u0a3e-\u0a42\u0a47-\u0a48\u0a4b-\u0a4d\u0a51\u0a59-\u0a5c\u0a5e\u0a66-\u0a75\u0a81-\u0a83\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abc-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ad0\u0ae0-\u0ae3\u0ae6-\u0aef\u0af9-\u0aff\u0b01-\u0b03\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3c-\u0b44\u0b47-\u0b48\u0b4b-\u0b4d\u0b56-\u0b57\u0b5c-\u0b5d\u0b5f-\u0b63\u0b66-\u0b6f\u0b71\u0b82-\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd0\u0bd7\u0be6-\u0bef\u0c00-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55-\u0c56\u0c58-\u0c5a\u0c60-\u0c63\u0c66-\u0c6f\u0c80-\u0c83\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbc-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5-\u0cd6\u0cde\u0ce0-\u0ce3\u0ce6-\u0cef\u0cf1-\u0cf2\u0d00-\u0d03\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d44\u0d46-\u0d48\u0d4a-\u0d4e\u0d54-\u0d57\u0d5f-\u0d63\u0d66-\u0d6f\u0d7a-\u0d7f\u0d82-\u0d83\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0de6-\u0def\u0df2-\u0df3\u0e01-\u0e3a\u0e40-\u0e4e\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e86-\u0e8a\u0e8c-\u0ea3\u0ea5\u0ea7-\u0ebd\u0ec0-\u0ec4\u0ec6\u0ec8-\u0ecd\u0ed0-\u0ed9\u0edc-\u0edf\u0f00\u0f18-\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e-\u0f47\u0f49-\u0f6c\u0f71-\u0f84\u0f86-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1049\u1050-\u109d\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u135d-\u135f\u1369-\u1371\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f8\u1700-\u170c\u170e-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176c\u176e-\u1770\u1772-\u1773\u1780-\u17d3\u17d7\u17dc-\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1820-\u1878\u1880-\u18aa\u18b0-\u18f5\u1900-\u191e\u1920-\u192b\u1930-\u193b\u1946-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u19d0-\u19da\u1a00-\u1a1b\u1a20-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1aa7\u1ab0-\u1abd\u1b00-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1bf3\u1c00-\u1c37\u1c40-\u1c49\u1c4d-\u1c7d\u1c80-\u1c88\u1c90-\u1cba\u1cbd-\u1cbf\u1cd0-\u1cd2\u1cd4-\u1cfa\u1d00-\u1df9\u1dfb-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u203f-\u2040\u2054\u2071\u207f\u2090-\u209c\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2102\u2107\u210a-\u2113\u2115\u2118-\u211d\u2124\u2126\u2128\u212a-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d7f-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2de0-\u2dff\u3005-\u3007\u3021-\u302f\u3031-\u3035\u3038-\u303c\u3041-\u3096\u3099-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312f\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fef\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua62b\ua640-\ua66f\ua674-\ua67d\ua67f-\ua6f1\ua717-\ua71f\ua722-\ua788\ua78b-\ua7bf\ua7c2-\ua7c6\ua7f7-\ua827\ua840-\ua873\ua880-\ua8c5\ua8d0-\ua8d9\ua8e0-\ua8f7\ua8fb\ua8fd-\ua92d\ua930-\ua953\ua960-\ua97c\ua980-\ua9c0\ua9cf-\ua9d9\ua9e0-\ua9fe\uaa00-\uaa36\uaa40-\uaa4d\uaa50-\uaa59\uaa60-\uaa76\uaa7a-\uaac2\uaadb-\uaadd\uaae0-\uaaef\uaaf2-\uaaf6\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab67\uab70-\uabea\uabec-\uabed\uabf0-\uabf9\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe00-\ufe0f\ufe20-\ufe2f\ufe33-\ufe34\ufe4d-\ufe4f\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff3f\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]|\ud800[\udc00-\udc0b\udc0d-\udc26\udc28-\udc3a\udc3c-\udc3d\udc3f-\udc4d\udc50-\udc5d\udc80-\udcfa\udd40-\udd74\uddfd\ude80-\ude9c\udea0-\uded0\udee0\udf00-\udf1f\udf2d-\udf4a\udf50-\udf7a\udf80-\udf9d\udfa0-\udfc3\udfc8-\udfcf\udfd1-\udfd5]|\ud801[\udc00-\udc9d\udca0-\udca9\udcb0-\udcd3\udcd8-\udcfb\udd00-\udd27\udd30-\udd63\ude00-\udf36\udf40-\udf55\udf60-\udf67]|\ud802[\udc00-\udc05\udc08\udc0a-\udc35\udc37-\udc38\udc3c\udc3f-\udc55\udc60-\udc76\udc80-\udc9e\udce0-\udcf2\udcf4-\udcf5\udd00-\udd15\udd20-\udd39\udd80-\uddb7\uddbe-\uddbf\ude00-\ude03\ude05-\ude06\ude0c-\ude13\ude15-\ude17\ude19-\ude35\ude38-\ude3a\ude3f\ude60-\ude7c\ude80-\ude9c\udec0-\udec7\udec9-\udee6\udf00-\udf35\udf40-\udf55\udf60-\udf72\udf80-\udf91]|\ud803[\udc00-\udc48\udc80-\udcb2\udcc0-\udcf2\udd00-\udd27\udd30-\udd39\udf00-\udf1c\udf27\udf30-\udf50\udfe0-\udff6]|\ud804[\udc00-\udc46\udc66-\udc6f\udc7f-\udcba\udcd0-\udce8\udcf0-\udcf9\udd00-\udd34\udd36-\udd3f\udd44-\udd46\udd50-\udd73\udd76\udd80-\uddc4\uddc9-\uddcc\uddd0-\uddda\udddc\ude00-\ude11\ude13-\ude37\ude3e\ude80-\ude86\ude88\ude8a-\ude8d\ude8f-\ude9d\ude9f-\udea8\udeb0-\udeea\udef0-\udef9\udf00-\udf03\udf05-\udf0c\udf0f-\udf10\udf13-\udf28\udf2a-\udf30\udf32-\udf33\udf35-\udf39\udf3b-\udf44\udf47-\udf48\udf4b-\udf4d\udf50\udf57\udf5d-\udf63\udf66-\udf6c\udf70-\udf74]|\ud805[\udc00-\udc4a\udc50-\udc59\udc5e-\udc5f\udc80-\udcc5\udcc7\udcd0-\udcd9\udd80-\uddb5\uddb8-\uddc0\uddd8-\udddd\ude00-\ude40\ude44\ude50-\ude59\ude80-\udeb8\udec0-\udec9\udf00-\udf1a\udf1d-\udf2b\udf30-\udf39]|\ud806[\udc00-\udc3a\udca0-\udce9\udcff\udda0-\udda7\uddaa-\uddd7\uddda-\udde1\udde3-\udde4\ude00-\ude3e\ude47\ude50-\ude99\ude9d\udec0-\udef8]|\ud807[\udc00-\udc08\udc0a-\udc36\udc38-\udc40\udc50-\udc59\udc72-\udc8f\udc92-\udca7\udca9-\udcb6\udd00-\udd06\udd08-\udd09\udd0b-\udd36\udd3a\udd3c-\udd3d\udd3f-\udd47\udd50-\udd59\udd60-\udd65\udd67-\udd68\udd6a-\udd8e\udd90-\udd91\udd93-\udd98\udda0-\udda9\udee0-\udef6]|\ud808[\udc00-\udf99]|\ud809[\udc00-\udc6e\udc80-\udd43]|\ud80c[\udc00-\udfff]|\ud80d[\udc00-\udc2e]|\ud811[\udc00-\ude46]|\ud81a[\udc00-\ude38\ude40-\ude5e\ude60-\ude69\uded0-\udeed\udef0-\udef4\udf00-\udf36\udf40-\udf43\udf50-\udf59\udf63-\udf77\udf7d-\udf8f]|\ud81b[\ude40-\ude7f\udf00-\udf4a\udf4f-\udf87\udf8f-\udf9f\udfe0-\udfe1\udfe3]|\ud81c[\udc00-\udfff]|\ud81d[\udc00-\udfff]|\ud81e[\udc00-\udfff]|\ud81f[\udc00-\udfff]|\ud820[\udc00-\udfff]|\ud821[\udc00-\udff7]|\ud822[\udc00-\udef2]|\ud82c[\udc00-\udd1e\udd50-\udd52\udd64-\udd67\udd70-\udefb]|\ud82f[\udc00-\udc6a\udc70-\udc7c\udc80-\udc88\udc90-\udc99\udc9d-\udc9e]|\ud834[\udd65-\udd69\udd6d-\udd72\udd7b-\udd82\udd85-\udd8b\uddaa-\uddad\ude42-\ude44]|\ud835[\udc00-\udc54\udc56-\udc9c\udc9e-\udc9f\udca2\udca5-\udca6\udca9-\udcac\udcae-\udcb9\udcbb\udcbd-\udcc3\udcc5-\udd05\udd07-\udd0a\udd0d-\udd14\udd16-\udd1c\udd1e-\udd39\udd3b-\udd3e\udd40-\udd44\udd46\udd4a-\udd50\udd52-\udea5\udea8-\udec0\udec2-\udeda\udedc-\udefa\udefc-\udf14\udf16-\udf34\udf36-\udf4e\udf50-\udf6e\udf70-\udf88\udf8a-\udfa8\udfaa-\udfc2\udfc4-\udfcb\udfce-\udfff]|\ud836[\ude00-\ude36\ude3b-\ude6c\ude75\ude84\ude9b-\ude9f\udea1-\udeaf]|\ud838[\udc00-\udc06\udc08-\udc18\udc1b-\udc21\udc23-\udc24\udc26-\udc2a\udd00-\udd2c\udd30-\udd3d\udd40-\udd49\udd4e\udec0-\udef9]|\ud83a[\udc00-\udcc4\udcd0-\udcd6\udd00-\udd4b\udd50-\udd59]|\ud83b[\ude00-\ude03\ude05-\ude1f\ude21-\ude22\ude24\ude27\ude29-\ude32\ude34-\ude37\ude39\ude3b\ude42\ude47\ude49\ude4b\ude4d-\ude4f\ude51-\ude52\ude54\ude57\ude59\ude5b\ude5d\ude5f\ude61-\ude62\ude64\ude67-\ude6a\ude6c-\ude72\ude74-\ude77\ude79-\ude7c\ude7e\ude80-\ude89\ude8b-\ude9b\udea1-\udea3\udea5-\udea9\udeab-\udebb]|\ud840[\udc00-\udfff]|\ud841[\udc00-\udfff]|\ud842[\udc00-\udfff]|\ud843[\udc00-\udfff]|\ud844[\udc00-\udfff]|\ud845[\udc00-\udfff]|\ud846[\udc00-\udfff]|\ud847[\udc00-\udfff]|\ud848[\udc00-\udfff]|\ud849[\udc00-\udfff]|\ud84a[\udc00-\udfff]|\ud84b[\udc00-\udfff]|\ud84c[\udc00-\udfff]|\ud84d[\udc00-\udfff]|\ud84e[\udc00-\udfff]|\ud84f[\udc00-\udfff]|\ud850[\udc00-\udfff]|\ud851[\udc00-\udfff]|\ud852[\udc00-\udfff]|\ud853[\udc00-\udfff]|\ud854[\udc00-\udfff]|\ud855[\udc00-\udfff]|\ud856[\udc00-\udfff]|\ud857[\udc00-\udfff]|\ud858[\udc00-\udfff]|\ud859[\udc00-\udfff]|\ud85a[\udc00-\udfff]|\ud85b[\udc00-\udfff]|\ud85c[\udc00-\udfff]|\ud85d[\udc00-\udfff]|\ud85e[\udc00-\udfff]|\ud85f[\udc00-\udfff]|\ud860[\udc00-\udfff]|\ud861[\udc00-\udfff]|\ud862[\udc00-\udfff]|\ud863[\udc00-\udfff]|\ud864[\udc00-\udfff]|\ud865[\udc00-\udfff]|\ud866[\udc00-\udfff]|\ud867[\udc00-\udfff]|\ud868[\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|\ud86a[\udc00-\udfff]|\ud86b[\udc00-\udfff]|\ud86c[\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d\udc20-\udfff]|\ud86f[\udc00-\udfff]|\ud870[\udc00-\udfff]|\ud871[\udc00-\udfff]|\ud872[\udc00-\udfff]|\ud873[\udc00-\udea1\udeb0-\udfff]|\ud874[\udc00-\udfff]|\ud875[\udc00-\udfff]|\ud876[\udc00-\udfff]|\ud877[\udc00-\udfff]|\ud878[\udc00-\udfff]|\ud879[\udc00-\udfff]|\ud87a[\udc00-\udfe0]|\ud87e[\udc00-\ude1d]|\udb40[\udd00-\uddef])|[$_]|(\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]{1,}\})|[\u200c\u200d])*>/, function() {
      var groupName = yytext.slice(3, -1);
      validateUnicodeGroupName(groupName, this.getCurrentState());
      return "NAMED_GROUP_REF";
    }], [/^\\b/, function() {
      return "ESC_b";
    }], [/^\\B/, function() {
      return "ESC_B";
    }], [/^\\c[a-zA-Z]/, function() {
      return "CTRL_CH";
    }], [/^\\0\d{1,2}/, function() {
      return "OCT_CODE";
    }], [/^\\0/, function() {
      return "DEC_CODE";
    }], [/^\\\d{1,3}/, function() {
      return "DEC_CODE";
    }], [/^\\u[dD][89abAB][0-9a-fA-F]{2}\\u[dD][c-fC-F][0-9a-fA-F]{2}/, function() {
      return "U_CODE_SURROGATE";
    }], [/^\\u\{[0-9a-fA-F]{1,}\}/, function() {
      return "U_CODE";
    }], [/^\\u[0-9a-fA-F]{4}/, function() {
      return "U_CODE";
    }], [/^\\[pP]\{\w+(?:=\w+)?\}/, function() {
      return "U_PROP_VALUE_EXP";
    }], [/^\\x[0-9a-fA-F]{2}/, function() {
      return "HEX_CODE";
    }], [/^\\[tnrdDsSwWvf]/, function() {
      return "META_CHAR";
    }], [/^\\\//, function() {
      return "ESC_CHAR";
    }], [/^\\[ #]/, function() {
      return "ESC_CHAR";
    }], [/^\\[\^\$\.\*\+\?\(\)\\\[\]\{\}\|\/]/, function() {
      return "ESC_CHAR";
    }], [/^\\[^*?+\[()\\|]/, function() {
      var s = this.getCurrentState();
      if (s === "u_class" && yytext === "\\-") {
        return "ESC_CHAR";
      } else if (s === "u" || s === "xu" || s === "u_class") {
        throw new SyntaxError("invalid Unicode escape " + yytext);
      }
      return "ESC_CHAR";
    }], [/^\(/, function() {
      return "CHAR";
    }], [/^\)/, function() {
      return "CHAR";
    }], [/^\(\?=/, function() {
      return "POS_LA_ASSERT";
    }], [/^\(\?!/, function() {
      return "NEG_LA_ASSERT";
    }], [/^\(\?<=/, function() {
      return "POS_LB_ASSERT";
    }], [/^\(\?<!/, function() {
      return "NEG_LB_ASSERT";
    }], [/^\(\?:/, function() {
      return "NON_CAPTURE_GROUP";
    }], [/^\(\?<(([\u0041-\u005a\u0061-\u007a\u00aa\u00b5\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376-\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0560-\u0588\u05d0-\u05ea\u05ef-\u05f2\u0620-\u064a\u066e-\u066f\u0671-\u06d3\u06d5\u06e5-\u06e6\u06ee-\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4-\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u0860-\u086a\u08a0-\u08b4\u08b6-\u08bd\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc-\u09dd\u09df-\u09e1\u09f0-\u09f1\u09fc\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0-\u0ae1\u0af9\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3d\u0b5c-\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c60-\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0-\u0ce1\u0cf1-\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32-\u0e33\u0e40-\u0e46\u0e81-\u0e82\u0e84\u0e86-\u0e8a\u0e8c-\u0ea3\u0ea5\u0ea7-\u0eb0\u0eb2-\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065-\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f8\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1878\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae-\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1c90-\u1cba\u1cbd-\u1cbf\u1ce9-\u1cec\u1cee-\u1cf3\u1cf5-\u1cf6\u1cfa\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2118-\u211d\u2124\u2126\u2128\u212a-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309b-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312f\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fef\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a-\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua7bf\ua7c2-\ua7c6\ua7f7-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd-\ua8fe\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5-\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab67\uab70-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]|\ud800[\udc00-\udc0b\udc0d-\udc26\udc28-\udc3a\udc3c-\udc3d\udc3f-\udc4d\udc50-\udc5d\udc80-\udcfa\udd40-\udd74\ude80-\ude9c\udea0-\uded0\udf00-\udf1f\udf2d-\udf4a\udf50-\udf75\udf80-\udf9d\udfa0-\udfc3\udfc8-\udfcf\udfd1-\udfd5]|\ud801[\udc00-\udc9d\udcb0-\udcd3\udcd8-\udcfb\udd00-\udd27\udd30-\udd63\ude00-\udf36\udf40-\udf55\udf60-\udf67]|\ud802[\udc00-\udc05\udc08\udc0a-\udc35\udc37-\udc38\udc3c\udc3f-\udc55\udc60-\udc76\udc80-\udc9e\udce0-\udcf2\udcf4-\udcf5\udd00-\udd15\udd20-\udd39\udd80-\uddb7\uddbe-\uddbf\ude00\ude10-\ude13\ude15-\ude17\ude19-\ude35\ude60-\ude7c\ude80-\ude9c\udec0-\udec7\udec9-\udee4\udf00-\udf35\udf40-\udf55\udf60-\udf72\udf80-\udf91]|\ud803[\udc00-\udc48\udc80-\udcb2\udcc0-\udcf2\udd00-\udd23\udf00-\udf1c\udf27\udf30-\udf45\udfe0-\udff6]|\ud804[\udc03-\udc37\udc83-\udcaf\udcd0-\udce8\udd03-\udd26\udd44\udd50-\udd72\udd76\udd83-\uddb2\uddc1-\uddc4\uddda\udddc\ude00-\ude11\ude13-\ude2b\ude80-\ude86\ude88\ude8a-\ude8d\ude8f-\ude9d\ude9f-\udea8\udeb0-\udede\udf05-\udf0c\udf0f-\udf10\udf13-\udf28\udf2a-\udf30\udf32-\udf33\udf35-\udf39\udf3d\udf50\udf5d-\udf61]|\ud805[\udc00-\udc34\udc47-\udc4a\udc5f\udc80-\udcaf\udcc4-\udcc5\udcc7\udd80-\uddae\uddd8-\udddb\ude00-\ude2f\ude44\ude80-\udeaa\udeb8\udf00-\udf1a]|\ud806[\udc00-\udc2b\udca0-\udcdf\udcff\udda0-\udda7\uddaa-\uddd0\udde1\udde3\ude00\ude0b-\ude32\ude3a\ude50\ude5c-\ude89\ude9d\udec0-\udef8]|\ud807[\udc00-\udc08\udc0a-\udc2e\udc40\udc72-\udc8f\udd00-\udd06\udd08-\udd09\udd0b-\udd30\udd46\udd60-\udd65\udd67-\udd68\udd6a-\udd89\udd98\udee0-\udef2]|\ud808[\udc00-\udf99]|\ud809[\udc00-\udc6e\udc80-\udd43]|\ud80c[\udc00-\udfff]|\ud80d[\udc00-\udc2e]|\ud811[\udc00-\ude46]|\ud81a[\udc00-\ude38\ude40-\ude5e\uded0-\udeed\udf00-\udf2f\udf40-\udf43\udf63-\udf77\udf7d-\udf8f]|\ud81b[\ude40-\ude7f\udf00-\udf4a\udf50\udf93-\udf9f\udfe0-\udfe1\udfe3]|\ud81c[\udc00-\udfff]|\ud81d[\udc00-\udfff]|\ud81e[\udc00-\udfff]|\ud81f[\udc00-\udfff]|\ud820[\udc00-\udfff]|\ud821[\udc00-\udff7]|\ud822[\udc00-\udef2]|\ud82c[\udc00-\udd1e\udd50-\udd52\udd64-\udd67\udd70-\udefb]|\ud82f[\udc00-\udc6a\udc70-\udc7c\udc80-\udc88\udc90-\udc99]|\ud835[\udc00-\udc54\udc56-\udc9c\udc9e-\udc9f\udca2\udca5-\udca6\udca9-\udcac\udcae-\udcb9\udcbb\udcbd-\udcc3\udcc5-\udd05\udd07-\udd0a\udd0d-\udd14\udd16-\udd1c\udd1e-\udd39\udd3b-\udd3e\udd40-\udd44\udd46\udd4a-\udd50\udd52-\udea5\udea8-\udec0\udec2-\udeda\udedc-\udefa\udefc-\udf14\udf16-\udf34\udf36-\udf4e\udf50-\udf6e\udf70-\udf88\udf8a-\udfa8\udfaa-\udfc2\udfc4-\udfcb]|\ud838[\udd00-\udd2c\udd37-\udd3d\udd4e\udec0-\udeeb]|\ud83a[\udc00-\udcc4\udd00-\udd43\udd4b]|\ud83b[\ude00-\ude03\ude05-\ude1f\ude21-\ude22\ude24\ude27\ude29-\ude32\ude34-\ude37\ude39\ude3b\ude42\ude47\ude49\ude4b\ude4d-\ude4f\ude51-\ude52\ude54\ude57\ude59\ude5b\ude5d\ude5f\ude61-\ude62\ude64\ude67-\ude6a\ude6c-\ude72\ude74-\ude77\ude79-\ude7c\ude7e\ude80-\ude89\ude8b-\ude9b\udea1-\udea3\udea5-\udea9\udeab-\udebb]|\ud840[\udc00-\udfff]|\ud841[\udc00-\udfff]|\ud842[\udc00-\udfff]|\ud843[\udc00-\udfff]|\ud844[\udc00-\udfff]|\ud845[\udc00-\udfff]|\ud846[\udc00-\udfff]|\ud847[\udc00-\udfff]|\ud848[\udc00-\udfff]|\ud849[\udc00-\udfff]|\ud84a[\udc00-\udfff]|\ud84b[\udc00-\udfff]|\ud84c[\udc00-\udfff]|\ud84d[\udc00-\udfff]|\ud84e[\udc00-\udfff]|\ud84f[\udc00-\udfff]|\ud850[\udc00-\udfff]|\ud851[\udc00-\udfff]|\ud852[\udc00-\udfff]|\ud853[\udc00-\udfff]|\ud854[\udc00-\udfff]|\ud855[\udc00-\udfff]|\ud856[\udc00-\udfff]|\ud857[\udc00-\udfff]|\ud858[\udc00-\udfff]|\ud859[\udc00-\udfff]|\ud85a[\udc00-\udfff]|\ud85b[\udc00-\udfff]|\ud85c[\udc00-\udfff]|\ud85d[\udc00-\udfff]|\ud85e[\udc00-\udfff]|\ud85f[\udc00-\udfff]|\ud860[\udc00-\udfff]|\ud861[\udc00-\udfff]|\ud862[\udc00-\udfff]|\ud863[\udc00-\udfff]|\ud864[\udc00-\udfff]|\ud865[\udc00-\udfff]|\ud866[\udc00-\udfff]|\ud867[\udc00-\udfff]|\ud868[\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|\ud86a[\udc00-\udfff]|\ud86b[\udc00-\udfff]|\ud86c[\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d\udc20-\udfff]|\ud86f[\udc00-\udfff]|\ud870[\udc00-\udfff]|\ud871[\udc00-\udfff]|\ud872[\udc00-\udfff]|\ud873[\udc00-\udea1\udeb0-\udfff]|\ud874[\udc00-\udfff]|\ud875[\udc00-\udfff]|\ud876[\udc00-\udfff]|\ud877[\udc00-\udfff]|\ud878[\udc00-\udfff]|\ud879[\udc00-\udfff]|\ud87a[\udc00-\udfe0]|\ud87e[\udc00-\ude1d])|[$_]|(\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]{1,}\}))(([\u0030-\u0039\u0041-\u005a\u005f\u0061-\u007a\u00aa\u00b5\u00b7\u00ba\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0300-\u0374\u0376-\u0377\u037a-\u037d\u037f\u0386-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u0483-\u0487\u048a-\u052f\u0531-\u0556\u0559\u0560-\u0588\u0591-\u05bd\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05c7\u05d0-\u05ea\u05ef-\u05f2\u0610-\u061a\u0620-\u0669\u066e-\u06d3\u06d5-\u06dc\u06df-\u06e8\u06ea-\u06fc\u06ff\u0710-\u074a\u074d-\u07b1\u07c0-\u07f5\u07fa\u07fd\u0800-\u082d\u0840-\u085b\u0860-\u086a\u08a0-\u08b4\u08b6-\u08bd\u08d3-\u08e1\u08e3-\u0963\u0966-\u096f\u0971-\u0983\u0985-\u098c\u098f-\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bc-\u09c4\u09c7-\u09c8\u09cb-\u09ce\u09d7\u09dc-\u09dd\u09df-\u09e3\u09e6-\u09f1\u09fc\u09fe\u0a01-\u0a03\u0a05-\u0a0a\u0a0f-\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32-\u0a33\u0a35-\u0a36\u0a38-\u0a39\u0a3c\u0a3e-\u0a42\u0a47-\u0a48\u0a4b-\u0a4d\u0a51\u0a59-\u0a5c\u0a5e\u0a66-\u0a75\u0a81-\u0a83\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2-\u0ab3\u0ab5-\u0ab9\u0abc-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ad0\u0ae0-\u0ae3\u0ae6-\u0aef\u0af9-\u0aff\u0b01-\u0b03\u0b05-\u0b0c\u0b0f-\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32-\u0b33\u0b35-\u0b39\u0b3c-\u0b44\u0b47-\u0b48\u0b4b-\u0b4d\u0b56-\u0b57\u0b5c-\u0b5d\u0b5f-\u0b63\u0b66-\u0b6f\u0b71\u0b82-\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99-\u0b9a\u0b9c\u0b9e-\u0b9f\u0ba3-\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd0\u0bd7\u0be6-\u0bef\u0c00-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55-\u0c56\u0c58-\u0c5a\u0c60-\u0c63\u0c66-\u0c6f\u0c80-\u0c83\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbc-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5-\u0cd6\u0cde\u0ce0-\u0ce3\u0ce6-\u0cef\u0cf1-\u0cf2\u0d00-\u0d03\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d44\u0d46-\u0d48\u0d4a-\u0d4e\u0d54-\u0d57\u0d5f-\u0d63\u0d66-\u0d6f\u0d7a-\u0d7f\u0d82-\u0d83\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0de6-\u0def\u0df2-\u0df3\u0e01-\u0e3a\u0e40-\u0e4e\u0e50-\u0e59\u0e81-\u0e82\u0e84\u0e86-\u0e8a\u0e8c-\u0ea3\u0ea5\u0ea7-\u0ebd\u0ec0-\u0ec4\u0ec6\u0ec8-\u0ecd\u0ed0-\u0ed9\u0edc-\u0edf\u0f00\u0f18-\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e-\u0f47\u0f49-\u0f6c\u0f71-\u0f84\u0f86-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1049\u1050-\u109d\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u135d-\u135f\u1369-\u1371\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f8\u1700-\u170c\u170e-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176c\u176e-\u1770\u1772-\u1773\u1780-\u17d3\u17d7\u17dc-\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1820-\u1878\u1880-\u18aa\u18b0-\u18f5\u1900-\u191e\u1920-\u192b\u1930-\u193b\u1946-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u19d0-\u19da\u1a00-\u1a1b\u1a20-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1aa7\u1ab0-\u1abd\u1b00-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1bf3\u1c00-\u1c37\u1c40-\u1c49\u1c4d-\u1c7d\u1c80-\u1c88\u1c90-\u1cba\u1cbd-\u1cbf\u1cd0-\u1cd2\u1cd4-\u1cfa\u1d00-\u1df9\u1dfb-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u203f-\u2040\u2054\u2071\u207f\u2090-\u209c\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2102\u2107\u210a-\u2113\u2115\u2118-\u211d\u2124\u2126\u2128\u212a-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d7f-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2de0-\u2dff\u3005-\u3007\u3021-\u302f\u3031-\u3035\u3038-\u303c\u3041-\u3096\u3099-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312f\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fef\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua62b\ua640-\ua66f\ua674-\ua67d\ua67f-\ua6f1\ua717-\ua71f\ua722-\ua788\ua78b-\ua7bf\ua7c2-\ua7c6\ua7f7-\ua827\ua840-\ua873\ua880-\ua8c5\ua8d0-\ua8d9\ua8e0-\ua8f7\ua8fb\ua8fd-\ua92d\ua930-\ua953\ua960-\ua97c\ua980-\ua9c0\ua9cf-\ua9d9\ua9e0-\ua9fe\uaa00-\uaa36\uaa40-\uaa4d\uaa50-\uaa59\uaa60-\uaa76\uaa7a-\uaac2\uaadb-\uaadd\uaae0-\uaaef\uaaf2-\uaaf6\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab67\uab70-\uabea\uabec-\uabed\uabf0-\uabf9\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe00-\ufe0f\ufe20-\ufe2f\ufe33-\ufe34\ufe4d-\ufe4f\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff3f\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]|\ud800[\udc00-\udc0b\udc0d-\udc26\udc28-\udc3a\udc3c-\udc3d\udc3f-\udc4d\udc50-\udc5d\udc80-\udcfa\udd40-\udd74\uddfd\ude80-\ude9c\udea0-\uded0\udee0\udf00-\udf1f\udf2d-\udf4a\udf50-\udf7a\udf80-\udf9d\udfa0-\udfc3\udfc8-\udfcf\udfd1-\udfd5]|\ud801[\udc00-\udc9d\udca0-\udca9\udcb0-\udcd3\udcd8-\udcfb\udd00-\udd27\udd30-\udd63\ude00-\udf36\udf40-\udf55\udf60-\udf67]|\ud802[\udc00-\udc05\udc08\udc0a-\udc35\udc37-\udc38\udc3c\udc3f-\udc55\udc60-\udc76\udc80-\udc9e\udce0-\udcf2\udcf4-\udcf5\udd00-\udd15\udd20-\udd39\udd80-\uddb7\uddbe-\uddbf\ude00-\ude03\ude05-\ude06\ude0c-\ude13\ude15-\ude17\ude19-\ude35\ude38-\ude3a\ude3f\ude60-\ude7c\ude80-\ude9c\udec0-\udec7\udec9-\udee6\udf00-\udf35\udf40-\udf55\udf60-\udf72\udf80-\udf91]|\ud803[\udc00-\udc48\udc80-\udcb2\udcc0-\udcf2\udd00-\udd27\udd30-\udd39\udf00-\udf1c\udf27\udf30-\udf50\udfe0-\udff6]|\ud804[\udc00-\udc46\udc66-\udc6f\udc7f-\udcba\udcd0-\udce8\udcf0-\udcf9\udd00-\udd34\udd36-\udd3f\udd44-\udd46\udd50-\udd73\udd76\udd80-\uddc4\uddc9-\uddcc\uddd0-\uddda\udddc\ude00-\ude11\ude13-\ude37\ude3e\ude80-\ude86\ude88\ude8a-\ude8d\ude8f-\ude9d\ude9f-\udea8\udeb0-\udeea\udef0-\udef9\udf00-\udf03\udf05-\udf0c\udf0f-\udf10\udf13-\udf28\udf2a-\udf30\udf32-\udf33\udf35-\udf39\udf3b-\udf44\udf47-\udf48\udf4b-\udf4d\udf50\udf57\udf5d-\udf63\udf66-\udf6c\udf70-\udf74]|\ud805[\udc00-\udc4a\udc50-\udc59\udc5e-\udc5f\udc80-\udcc5\udcc7\udcd0-\udcd9\udd80-\uddb5\uddb8-\uddc0\uddd8-\udddd\ude00-\ude40\ude44\ude50-\ude59\ude80-\udeb8\udec0-\udec9\udf00-\udf1a\udf1d-\udf2b\udf30-\udf39]|\ud806[\udc00-\udc3a\udca0-\udce9\udcff\udda0-\udda7\uddaa-\uddd7\uddda-\udde1\udde3-\udde4\ude00-\ude3e\ude47\ude50-\ude99\ude9d\udec0-\udef8]|\ud807[\udc00-\udc08\udc0a-\udc36\udc38-\udc40\udc50-\udc59\udc72-\udc8f\udc92-\udca7\udca9-\udcb6\udd00-\udd06\udd08-\udd09\udd0b-\udd36\udd3a\udd3c-\udd3d\udd3f-\udd47\udd50-\udd59\udd60-\udd65\udd67-\udd68\udd6a-\udd8e\udd90-\udd91\udd93-\udd98\udda0-\udda9\udee0-\udef6]|\ud808[\udc00-\udf99]|\ud809[\udc00-\udc6e\udc80-\udd43]|\ud80c[\udc00-\udfff]|\ud80d[\udc00-\udc2e]|\ud811[\udc00-\ude46]|\ud81a[\udc00-\ude38\ude40-\ude5e\ude60-\ude69\uded0-\udeed\udef0-\udef4\udf00-\udf36\udf40-\udf43\udf50-\udf59\udf63-\udf77\udf7d-\udf8f]|\ud81b[\ude40-\ude7f\udf00-\udf4a\udf4f-\udf87\udf8f-\udf9f\udfe0-\udfe1\udfe3]|\ud81c[\udc00-\udfff]|\ud81d[\udc00-\udfff]|\ud81e[\udc00-\udfff]|\ud81f[\udc00-\udfff]|\ud820[\udc00-\udfff]|\ud821[\udc00-\udff7]|\ud822[\udc00-\udef2]|\ud82c[\udc00-\udd1e\udd50-\udd52\udd64-\udd67\udd70-\udefb]|\ud82f[\udc00-\udc6a\udc70-\udc7c\udc80-\udc88\udc90-\udc99\udc9d-\udc9e]|\ud834[\udd65-\udd69\udd6d-\udd72\udd7b-\udd82\udd85-\udd8b\uddaa-\uddad\ude42-\ude44]|\ud835[\udc00-\udc54\udc56-\udc9c\udc9e-\udc9f\udca2\udca5-\udca6\udca9-\udcac\udcae-\udcb9\udcbb\udcbd-\udcc3\udcc5-\udd05\udd07-\udd0a\udd0d-\udd14\udd16-\udd1c\udd1e-\udd39\udd3b-\udd3e\udd40-\udd44\udd46\udd4a-\udd50\udd52-\udea5\udea8-\udec0\udec2-\udeda\udedc-\udefa\udefc-\udf14\udf16-\udf34\udf36-\udf4e\udf50-\udf6e\udf70-\udf88\udf8a-\udfa8\udfaa-\udfc2\udfc4-\udfcb\udfce-\udfff]|\ud836[\ude00-\ude36\ude3b-\ude6c\ude75\ude84\ude9b-\ude9f\udea1-\udeaf]|\ud838[\udc00-\udc06\udc08-\udc18\udc1b-\udc21\udc23-\udc24\udc26-\udc2a\udd00-\udd2c\udd30-\udd3d\udd40-\udd49\udd4e\udec0-\udef9]|\ud83a[\udc00-\udcc4\udcd0-\udcd6\udd00-\udd4b\udd50-\udd59]|\ud83b[\ude00-\ude03\ude05-\ude1f\ude21-\ude22\ude24\ude27\ude29-\ude32\ude34-\ude37\ude39\ude3b\ude42\ude47\ude49\ude4b\ude4d-\ude4f\ude51-\ude52\ude54\ude57\ude59\ude5b\ude5d\ude5f\ude61-\ude62\ude64\ude67-\ude6a\ude6c-\ude72\ude74-\ude77\ude79-\ude7c\ude7e\ude80-\ude89\ude8b-\ude9b\udea1-\udea3\udea5-\udea9\udeab-\udebb]|\ud840[\udc00-\udfff]|\ud841[\udc00-\udfff]|\ud842[\udc00-\udfff]|\ud843[\udc00-\udfff]|\ud844[\udc00-\udfff]|\ud845[\udc00-\udfff]|\ud846[\udc00-\udfff]|\ud847[\udc00-\udfff]|\ud848[\udc00-\udfff]|\ud849[\udc00-\udfff]|\ud84a[\udc00-\udfff]|\ud84b[\udc00-\udfff]|\ud84c[\udc00-\udfff]|\ud84d[\udc00-\udfff]|\ud84e[\udc00-\udfff]|\ud84f[\udc00-\udfff]|\ud850[\udc00-\udfff]|\ud851[\udc00-\udfff]|\ud852[\udc00-\udfff]|\ud853[\udc00-\udfff]|\ud854[\udc00-\udfff]|\ud855[\udc00-\udfff]|\ud856[\udc00-\udfff]|\ud857[\udc00-\udfff]|\ud858[\udc00-\udfff]|\ud859[\udc00-\udfff]|\ud85a[\udc00-\udfff]|\ud85b[\udc00-\udfff]|\ud85c[\udc00-\udfff]|\ud85d[\udc00-\udfff]|\ud85e[\udc00-\udfff]|\ud85f[\udc00-\udfff]|\ud860[\udc00-\udfff]|\ud861[\udc00-\udfff]|\ud862[\udc00-\udfff]|\ud863[\udc00-\udfff]|\ud864[\udc00-\udfff]|\ud865[\udc00-\udfff]|\ud866[\udc00-\udfff]|\ud867[\udc00-\udfff]|\ud868[\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|\ud86a[\udc00-\udfff]|\ud86b[\udc00-\udfff]|\ud86c[\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d\udc20-\udfff]|\ud86f[\udc00-\udfff]|\ud870[\udc00-\udfff]|\ud871[\udc00-\udfff]|\ud872[\udc00-\udfff]|\ud873[\udc00-\udea1\udeb0-\udfff]|\ud874[\udc00-\udfff]|\ud875[\udc00-\udfff]|\ud876[\udc00-\udfff]|\ud877[\udc00-\udfff]|\ud878[\udc00-\udfff]|\ud879[\udc00-\udfff]|\ud87a[\udc00-\udfe0]|\ud87e[\udc00-\ude1d]|\udb40[\udd00-\uddef])|[$_]|(\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]{1,}\})|[\u200c\u200d])*>/, function() {
      yytext = yytext.slice(3, -1);
      validateUnicodeGroupName(yytext, this.getCurrentState());
      return "NAMED_CAPTURE_GROUP";
    }], [/^\(/, function() {
      return "L_PAREN";
    }], [/^\)/, function() {
      return "R_PAREN";
    }], [/^[*?+[^$]/, function() {
      return "CHAR";
    }], [/^\\\]/, function() {
      return "ESC_CHAR";
    }], [/^\]/, function() {
      this.popState();
      return "R_BRACKET";
    }], [/^\^/, function() {
      return "BOS";
    }], [/^\$/, function() {
      return "EOS";
    }], [/^\*/, function() {
      return "STAR";
    }], [/^\?/, function() {
      return "Q_MARK";
    }], [/^\+/, function() {
      return "PLUS";
    }], [/^\|/, function() {
      return "BAR";
    }], [/^\./, function() {
      return "ANY";
    }], [/^\//, function() {
      return "SLASH";
    }], [/^[^*?+\[()\\|]/, function() {
      return "CHAR";
    }], [/^\[\^/, function() {
      var s = this.getCurrentState();
      this.pushState(s === "u" || s === "xu" ? "u_class" : "class");
      return "NEG_CLASS";
    }], [/^\[/, function() {
      var s = this.getCurrentState();
      this.pushState(s === "u" || s === "xu" ? "u_class" : "class");
      return "L_BRACKET";
    }]];
    var lexRulesByConditions = { "INITIAL": [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 22, 23, 24, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], "u": [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], "xu": [0, 1, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], "x": [0, 1, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 22, 23, 24, 26, 27, 30, 31, 32, 33, 34, 35, 36, 37, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], "u_class": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51], "class": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51] };
    var EOF_TOKEN = {
      type: EOF,
      value: ""
    };
    tokenizer = {
      initString: function initString(string) {
        this._string = string;
        this._cursor = 0;
        this._states = ["INITIAL"];
        this._tokensQueue = [];
        this._currentLine = 1;
        this._currentColumn = 0;
        this._currentLineBeginOffset = 0;
        this._tokenStartOffset = 0;
        this._tokenEndOffset = 0;
        this._tokenStartLine = 1;
        this._tokenEndLine = 1;
        this._tokenStartColumn = 0;
        this._tokenEndColumn = 0;
        return this;
      },
      getStates: function getStates() {
        return this._states;
      },
      getCurrentState: function getCurrentState() {
        return this._states[this._states.length - 1];
      },
      pushState: function pushState(state) {
        this._states.push(state);
      },
      begin: function begin(state) {
        this.pushState(state);
      },
      popState: function popState() {
        if (this._states.length > 1) {
          return this._states.pop();
        }
        return this._states[0];
      },
      getNextToken: function getNextToken() {
        if (this._tokensQueue.length > 0) {
          return this.onToken(this._toToken(this._tokensQueue.shift()));
        }
        if (!this.hasMoreTokens()) {
          return this.onToken(EOF_TOKEN);
        }
        var string = this._string.slice(this._cursor);
        var lexRulesForState = lexRulesByConditions[this.getCurrentState()];
        for (var i = 0; i < lexRulesForState.length; i++) {
          var lexRuleIndex = lexRulesForState[i];
          var lexRule = lexRules[lexRuleIndex];
          var matched = this._match(string, lexRule[0]);
          if (string === "" && matched === "") {
            this._cursor++;
          }
          if (matched !== null) {
            yytext = matched;
            yyleng = yytext.length;
            var token = lexRule[1].call(this);
            if (!token) {
              return this.getNextToken();
            }
            if (Array.isArray(token)) {
              var tokensToQueue = token.slice(1);
              token = token[0];
              if (tokensToQueue.length > 0) {
                var _tokensQueue;
                (_tokensQueue = this._tokensQueue).unshift.apply(_tokensQueue, _toConsumableArray(tokensToQueue));
              }
            }
            return this.onToken(this._toToken(token, yytext));
          }
        }
        if (this.isEOF()) {
          this._cursor++;
          return EOF_TOKEN;
        }
        this.throwUnexpectedToken(string[0], this._currentLine, this._currentColumn);
      },
      throwUnexpectedToken: function throwUnexpectedToken(symbol, line, column) {
        var lineSource = this._string.split("\n")[line - 1];
        var lineData = "";
        if (lineSource) {
          var pad = " ".repeat(column);
          lineData = "\n\n" + lineSource + "\n" + pad + "^\n";
        }
        throw new SyntaxError(lineData + 'Unexpected token: "' + symbol + '" ' + ("at " + line + ":" + column + "."));
      },
      getCursor: function getCursor() {
        return this._cursor;
      },
      getCurrentLine: function getCurrentLine() {
        return this._currentLine;
      },
      getCurrentColumn: function getCurrentColumn() {
        return this._currentColumn;
      },
      _captureLocation: function _captureLocation(matched) {
        var nlRe = /\n/g;
        this._tokenStartOffset = this._cursor;
        this._tokenStartLine = this._currentLine;
        this._tokenStartColumn = this._tokenStartOffset - this._currentLineBeginOffset;
        var nlMatch = void 0;
        while ((nlMatch = nlRe.exec(matched)) !== null) {
          this._currentLine++;
          this._currentLineBeginOffset = this._tokenStartOffset + nlMatch.index + 1;
        }
        this._tokenEndOffset = this._cursor + matched.length;
        this._tokenEndLine = this._currentLine;
        this._tokenEndColumn = this._currentColumn = this._tokenEndOffset - this._currentLineBeginOffset;
      },
      _toToken: function _toToken(tokenType) {
        var yytext2 = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "";
        return {
          type: tokenType,
          value: yytext2,
          startOffset: this._tokenStartOffset,
          endOffset: this._tokenEndOffset,
          startLine: this._tokenStartLine,
          endLine: this._tokenEndLine,
          startColumn: this._tokenStartColumn,
          endColumn: this._tokenEndColumn
        };
      },
      isEOF: function isEOF() {
        return this._cursor === this._string.length;
      },
      hasMoreTokens: function hasMoreTokens() {
        return this._cursor <= this._string.length;
      },
      _match: function _match(string, regexp) {
        var matched = string.match(regexp);
        if (matched) {
          this._captureLocation(matched[0]);
          this._cursor += matched[0].length;
          return matched[0];
        }
        return null;
      },
      onToken: function onToken(token) {
        return token;
      }
    };
    yy.lexer = tokenizer;
    yy.tokenizer = tokenizer;
    yy.options = {
      captureLocations: true
    };
    var yyparse = {
      setOptions: function setOptions(options) {
        yy.options = options;
        return this;
      },
      getOptions: function getOptions() {
        return yy.options;
      },
      parse: function parse(string, parseOptions) {
        if (!tokenizer) {
          throw new Error("Tokenizer instance wasn't specified.");
        }
        tokenizer.initString(string);
        var globalOptions = yy.options;
        if (parseOptions) {
          yy.options = Object.assign({}, yy.options, parseOptions);
        }
        yyparse.onParseBegin(string, tokenizer, yy.options);
        stack.length = 0;
        stack.push(0);
        var token = tokenizer.getNextToken();
        var shiftedToken = null;
        do {
          if (!token) {
            yy.options = globalOptions;
            unexpectedEndOfInput();
          }
          var state = stack[stack.length - 1];
          var column = tokens[token.type];
          if (!table[state].hasOwnProperty(column)) {
            yy.options = globalOptions;
            unexpectedToken(token);
          }
          var entry = table[state][column];
          if (entry[0] === "s") {
            var _loc2 = null;
            if (yy.options.captureLocations) {
              _loc2 = {
                startOffset: token.startOffset,
                endOffset: token.endOffset,
                startLine: token.startLine,
                endLine: token.endLine,
                startColumn: token.startColumn,
                endColumn: token.endColumn
              };
            }
            shiftedToken = this.onShift(token);
            stack.push({ symbol: tokens[shiftedToken.type], semanticValue: shiftedToken.value, loc: _loc2 }, Number(entry.slice(1)));
            token = tokenizer.getNextToken();
          } else if (entry[0] === "r") {
            var productionNumber = entry.slice(1);
            var production = productions[productionNumber];
            var hasSemanticAction = typeof production[2] === "function";
            var semanticValueArgs = hasSemanticAction ? [] : null;
            var locationArgs = hasSemanticAction && yy.options.captureLocations ? [] : null;
            if (production[1] !== 0) {
              var rhsLength = production[1];
              while (rhsLength-- > 0) {
                stack.pop();
                var stackEntry = stack.pop();
                if (hasSemanticAction) {
                  semanticValueArgs.unshift(stackEntry.semanticValue);
                  if (locationArgs) {
                    locationArgs.unshift(stackEntry.loc);
                  }
                }
              }
            }
            var reduceStackEntry = { symbol: production[0] };
            if (hasSemanticAction) {
              yytext = shiftedToken ? shiftedToken.value : null;
              yyleng = shiftedToken ? shiftedToken.value.length : null;
              var semanticActionArgs = locationArgs !== null ? semanticValueArgs.concat(locationArgs) : semanticValueArgs;
              production[2].apply(production, _toConsumableArray(semanticActionArgs));
              reduceStackEntry.semanticValue = __;
              if (locationArgs) {
                reduceStackEntry.loc = __loc;
              }
            }
            var nextState = stack[stack.length - 1];
            var symbolToReduceWith = production[0];
            stack.push(reduceStackEntry, table[nextState][symbolToReduceWith]);
          } else if (entry === "acc") {
            stack.pop();
            var parsed = stack.pop();
            if (stack.length !== 1 || stack[0] !== 0 || tokenizer.hasMoreTokens()) {
              yy.options = globalOptions;
              unexpectedToken(token);
            }
            if (parsed.hasOwnProperty("semanticValue")) {
              yy.options = globalOptions;
              yyparse.onParseEnd(parsed.semanticValue);
              return parsed.semanticValue;
            }
            yyparse.onParseEnd();
            yy.options = globalOptions;
            return true;
          }
        } while (tokenizer.hasMoreTokens() || stack.length > 1);
      },
      setTokenizer: function setTokenizer(customTokenizer) {
        tokenizer = customTokenizer;
        return yyparse;
      },
      getTokenizer: function getTokenizer() {
        return tokenizer;
      },
      onParseBegin: function onParseBegin(string, tokenizer2, options) {
      },
      onParseEnd: function onParseEnd(parsed) {
      },
      onShift: function onShift(token) {
        return token;
      }
    };
    var capturingGroupsCount = 0;
    var namedGroups = {};
    var parsingString = "";
    yyparse.onParseBegin = function(string, lexer) {
      parsingString = string;
      capturingGroupsCount = 0;
      namedGroups = {};
      var lastSlash = string.lastIndexOf("/");
      var flags = string.slice(lastSlash);
      if (flags.includes("x") && flags.includes("u")) {
        lexer.pushState("xu");
      } else {
        if (flags.includes("x")) {
          lexer.pushState("x");
        }
        if (flags.includes("u")) {
          lexer.pushState("u");
        }
      }
    };
    yyparse.onShift = function(token) {
      if (token.type === "L_PAREN" || token.type === "NAMED_CAPTURE_GROUP") {
        token.value = new String(token.value);
        token.value.groupNumber = ++capturingGroupsCount;
      }
      return token;
    };
    function getRange(text) {
      var range = text.match(/\d+/g).map(Number);
      if (Number.isFinite(range[1]) && range[1] < range[0]) {
        throw new SyntaxError("Numbers out of order in " + text + " quantifier");
      }
      return range;
    }
    function checkClassRange(from, to) {
      if (from.kind === "control" || to.kind === "control" || !isNaN(from.codePoint) && !isNaN(to.codePoint) && from.codePoint > to.codePoint) {
        throw new SyntaxError("Range " + from.value + "-" + to.value + " out of order in character class");
      }
    }
    var unicodeProperties = require_parser_unicode_properties();
    function UnicodeProperty(matched, loc2) {
      var negative = matched[1] === "P";
      var separatorIdx = matched.indexOf("=");
      var name = matched.slice(3, separatorIdx !== -1 ? separatorIdx : -1);
      var value = void 0;
      var isShorthand = separatorIdx === -1 && unicodeProperties.isGeneralCategoryValue(name);
      var isBinaryProperty = separatorIdx === -1 && unicodeProperties.isBinaryPropertyName(name);
      if (isShorthand) {
        value = name;
        name = "General_Category";
      } else if (isBinaryProperty) {
        value = name;
      } else {
        if (!unicodeProperties.isValidName(name)) {
          throw new SyntaxError("Invalid unicode property name: " + name + ".");
        }
        value = matched.slice(separatorIdx + 1, -1);
        if (!unicodeProperties.isValidValue(name, value)) {
          throw new SyntaxError("Invalid " + name + " unicode property value: " + value + ".");
        }
      }
      return Node({
        type: "UnicodeProperty",
        name,
        value,
        negative,
        shorthand: isShorthand,
        binary: isBinaryProperty,
        canonicalName: unicodeProperties.getCanonicalName(name) || name,
        canonicalValue: unicodeProperties.getCanonicalValue(value) || value
      }, loc2);
    }
    function Char(value, kind, loc2) {
      var symbol = void 0;
      var codePoint = void 0;
      switch (kind) {
        case "decimal": {
          codePoint = Number(value.slice(1));
          symbol = String.fromCodePoint(codePoint);
          break;
        }
        case "oct": {
          codePoint = parseInt(value.slice(1), 8);
          symbol = String.fromCodePoint(codePoint);
          break;
        }
        case "hex":
        case "unicode": {
          if (value.lastIndexOf("\\u") > 0) {
            var _value$split$slice = value.split("\\u").slice(1), _value$split$slice2 = _slicedToArray(_value$split$slice, 2), lead = _value$split$slice2[0], trail = _value$split$slice2[1];
            lead = parseInt(lead, 16);
            trail = parseInt(trail, 16);
            codePoint = (lead - 55296) * 1024 + (trail - 56320) + 65536;
            symbol = String.fromCodePoint(codePoint);
          } else {
            var hex = value.slice(2).replace("{", "");
            codePoint = parseInt(hex, 16);
            if (codePoint > 1114111) {
              throw new SyntaxError("Bad character escape sequence: " + value);
            }
            symbol = String.fromCodePoint(codePoint);
          }
          break;
        }
        case "meta": {
          switch (value) {
            case "\\t":
              symbol = "	";
              codePoint = symbol.codePointAt(0);
              break;
            case "\\n":
              symbol = "\n";
              codePoint = symbol.codePointAt(0);
              break;
            case "\\r":
              symbol = "\r";
              codePoint = symbol.codePointAt(0);
              break;
            case "\\v":
              symbol = "\v";
              codePoint = symbol.codePointAt(0);
              break;
            case "\\f":
              symbol = "\f";
              codePoint = symbol.codePointAt(0);
              break;
            case "\\b":
              symbol = "\b";
              codePoint = symbol.codePointAt(0);
            case "\\0":
              symbol = "\0";
              codePoint = 0;
            case ".":
              symbol = ".";
              codePoint = NaN;
              break;
            default:
              codePoint = NaN;
          }
          break;
        }
        case "simple": {
          symbol = value;
          codePoint = symbol.codePointAt(0);
          break;
        }
      }
      return Node({
        type: "Char",
        value,
        kind,
        symbol,
        codePoint
      }, loc2);
    }
    var validFlags = "gimsuxy";
    function checkFlags(flags) {
      var seen = new Set();
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = void 0;
      try {
        for (var _iterator = flags[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var flag = _step.value;
          if (seen.has(flag) || !validFlags.includes(flag)) {
            throw new SyntaxError("Invalid flags: " + flags);
          }
          seen.add(flag);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
      return flags.split("").sort().join("");
    }
    function GroupRefOrDecChar(text, textLoc) {
      var reference = Number(text.slice(1));
      if (reference > 0 && reference <= capturingGroupsCount) {
        return Node({
          type: "Backreference",
          kind: "number",
          number: reference,
          reference
        }, textLoc);
      }
      return Char(text, "decimal", textLoc);
    }
    var uReStart = /^\\u[0-9a-fA-F]{4}/;
    var ucpReStart = /^\\u\{[0-9a-fA-F]{1,}\}/;
    var ucpReAnywhere = /\\u\{[0-9a-fA-F]{1,}\}/;
    function validateUnicodeGroupName(name, state) {
      var isUnicodeName = ucpReAnywhere.test(name);
      var isUnicodeState = state === "u" || state === "xu" || state === "u_class";
      if (isUnicodeName && !isUnicodeState) {
        throw new SyntaxError('invalid group Unicode name "' + name + '", use `u` flag.');
      }
      return name;
    }
    var uidRe = /\\u(?:([dD][89aAbB][0-9a-fA-F]{2})\\u([dD][c-fC-F][0-9a-fA-F]{2})|([dD][89aAbB][0-9a-fA-F]{2})|([dD][c-fC-F][0-9a-fA-F]{2})|([0-9a-ce-fA-CE-F][0-9a-fA-F]{3}|[dD][0-7][0-9a-fA-F]{2})|\{(0*(?:[0-9a-fA-F]{1,5}|10[0-9a-fA-F]{4}))\})/;
    function decodeUnicodeGroupName(name) {
      return name.replace(new RegExp(uidRe, "g"), function(_, leadSurrogate, trailSurrogate, leadSurrogateOnly, trailSurrogateOnly, nonSurrogate, codePoint) {
        if (leadSurrogate) {
          return String.fromCodePoint(parseInt(leadSurrogate, 16), parseInt(trailSurrogate, 16));
        }
        if (leadSurrogateOnly) {
          return String.fromCodePoint(parseInt(leadSurrogateOnly, 16));
        }
        if (trailSurrogateOnly) {
          return String.fromCodePoint(parseInt(trailSurrogateOnly, 16));
        }
        if (nonSurrogate) {
          return String.fromCodePoint(parseInt(nonSurrogate, 16));
        }
        if (codePoint) {
          return String.fromCodePoint(parseInt(codePoint, 16));
        }
        return _;
      });
    }
    function NamedGroupRefOrChars(text, textLoc) {
      var referenceRaw = text.slice(3, -1);
      var reference = decodeUnicodeGroupName(referenceRaw);
      if (namedGroups.hasOwnProperty(reference)) {
        return Node({
          type: "Backreference",
          kind: "name",
          number: namedGroups[reference],
          reference,
          referenceRaw
        }, textLoc);
      }
      var startOffset = null;
      var startLine = null;
      var endLine = null;
      var startColumn = null;
      if (textLoc) {
        startOffset = textLoc.startOffset;
        startLine = textLoc.startLine;
        endLine = textLoc.endLine;
        startColumn = textLoc.startColumn;
      }
      var charRe = /^[\w$<>]/;
      var loc2 = void 0;
      var chars = [
        Char(text.slice(1, 2), "simple", startOffset ? {
          startLine,
          endLine,
          startColumn,
          startOffset,
          endOffset: startOffset += 2,
          endColumn: startColumn += 2
        } : null)
      ];
      chars[0].escaped = true;
      text = text.slice(2);
      while (text.length > 0) {
        var matched = null;
        if ((matched = text.match(uReStart)) || (matched = text.match(ucpReStart))) {
          if (startOffset) {
            loc2 = {
              startLine,
              endLine,
              startColumn,
              startOffset,
              endOffset: startOffset += matched[0].length,
              endColumn: startColumn += matched[0].length
            };
          }
          chars.push(Char(matched[0], "unicode", loc2));
          text = text.slice(matched[0].length);
        } else if (matched = text.match(charRe)) {
          if (startOffset) {
            loc2 = {
              startLine,
              endLine,
              startColumn,
              startOffset,
              endOffset: ++startOffset,
              endColumn: ++startColumn
            };
          }
          chars.push(Char(matched[0], "simple", loc2));
          text = text.slice(1);
        }
      }
      return chars;
    }
    function Node(node, loc2) {
      if (yy.options.captureLocations) {
        node.loc = {
          source: parsingString.slice(loc2.startOffset, loc2.endOffset),
          start: {
            line: loc2.startLine,
            column: loc2.startColumn,
            offset: loc2.startOffset
          },
          end: {
            line: loc2.endLine,
            column: loc2.endColumn,
            offset: loc2.endOffset
          }
        };
      }
      return node;
    }
    function loc(start, end) {
      if (!yy.options.captureLocations) {
        return null;
      }
      return {
        startOffset: start.startOffset,
        endOffset: end.endOffset,
        startLine: start.startLine,
        endLine: end.endLine,
        startColumn: start.startColumn,
        endColumn: end.endColumn
      };
    }
    function unexpectedToken(token) {
      if (token.type === EOF) {
        unexpectedEndOfInput();
      }
      tokenizer.throwUnexpectedToken(token.value, token.startLine, token.startColumn);
    }
    function unexpectedEndOfInput() {
      parseError("Unexpected end of input.");
    }
    function parseError(message) {
      throw new SyntaxError(message);
    }
    module2.exports = yyparse;
  }
});

// node_modules/regexp-tree/dist/parser/index.js
var require_parser = __commonJS({
  "node_modules/regexp-tree/dist/parser/index.js"(exports, module2) {
    "use strict";
    var regexpTreeParser = require_regexp_tree();
    var generatedParseFn = regexpTreeParser.parse.bind(regexpTreeParser);
    regexpTreeParser.parse = function(regexp, options) {
      return generatedParseFn("" + regexp, options);
    };
    regexpTreeParser.setOptions({ captureLocations: false });
    module2.exports = regexpTreeParser;
  }
});

// node_modules/regexp-tree/dist/traverse/node-path.js
var require_node_path = __commonJS({
  "node_modules/regexp-tree/dist/traverse/node-path.js"(exports, module2) {
    "use strict";
    var _createClass = function() {
      function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
          var descriptor = props[i];
          descriptor.enumerable = descriptor.enumerable || false;
          descriptor.configurable = true;
          if ("value" in descriptor)
            descriptor.writable = true;
          Object.defineProperty(target, descriptor.key, descriptor);
        }
      }
      return function(Constructor, protoProps, staticProps) {
        if (protoProps)
          defineProperties(Constructor.prototype, protoProps);
        if (staticProps)
          defineProperties(Constructor, staticProps);
        return Constructor;
      };
    }();
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    var DEFAULT_COLLECTION_PROP = "expressions";
    var DEFAULT_SINGLE_PROP = "expression";
    var NodePath = function() {
      function NodePath2(node) {
        var parentPath = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
        var property = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : null;
        var index2 = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : null;
        _classCallCheck(this, NodePath2);
        this.node = node;
        this.parentPath = parentPath;
        this.parent = parentPath ? parentPath.node : null;
        this.property = property;
        this.index = index2;
      }
      _createClass(NodePath2, [{
        key: "_enforceProp",
        value: function _enforceProp(property) {
          if (!this.node.hasOwnProperty(property)) {
            throw new Error("Node of type " + this.node.type + ` doesn't have "` + property + '" collection.');
          }
        }
      }, {
        key: "setChild",
        value: function setChild(node) {
          var index2 = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
          var property = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : null;
          var childPath = void 0;
          if (index2 != null) {
            if (!property) {
              property = DEFAULT_COLLECTION_PROP;
            }
            this._enforceProp(property);
            this.node[property][index2] = node;
            childPath = NodePath2.getForNode(node, this, property, index2);
          } else {
            if (!property) {
              property = DEFAULT_SINGLE_PROP;
            }
            this._enforceProp(property);
            this.node[property] = node;
            childPath = NodePath2.getForNode(node, this, property, null);
          }
          return childPath;
        }
      }, {
        key: "appendChild",
        value: function appendChild(node) {
          var property = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
          if (!property) {
            property = DEFAULT_COLLECTION_PROP;
          }
          this._enforceProp(property);
          var end = this.node[property].length;
          return this.setChild(node, end, property);
        }
      }, {
        key: "insertChildAt",
        value: function insertChildAt(node, index2) {
          var property = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : DEFAULT_COLLECTION_PROP;
          this._enforceProp(property);
          this.node[property].splice(index2, 0, node);
          if (index2 <= NodePath2.getTraversingIndex()) {
            NodePath2.updateTraversingIndex(1);
          }
          this._rebuildIndex(this.node, property);
        }
      }, {
        key: "remove",
        value: function remove() {
          if (this.isRemoved()) {
            return;
          }
          NodePath2.registry.delete(this.node);
          this.node = null;
          if (!this.parent) {
            return;
          }
          if (this.index !== null) {
            this.parent[this.property].splice(this.index, 1);
            if (this.index <= NodePath2.getTraversingIndex()) {
              NodePath2.updateTraversingIndex(-1);
            }
            this._rebuildIndex(this.parent, this.property);
            this.index = null;
            this.property = null;
            return;
          }
          delete this.parent[this.property];
          this.property = null;
        }
      }, {
        key: "_rebuildIndex",
        value: function _rebuildIndex(parent, property) {
          var parentPath = NodePath2.getForNode(parent);
          for (var i = 0; i < parent[property].length; i++) {
            var path = NodePath2.getForNode(parent[property][i], parentPath, property, i);
            path.index = i;
          }
        }
      }, {
        key: "isRemoved",
        value: function isRemoved() {
          return this.node === null;
        }
      }, {
        key: "replace",
        value: function replace(newNode) {
          NodePath2.registry.delete(this.node);
          this.node = newNode;
          if (!this.parent) {
            return null;
          }
          if (this.index !== null) {
            this.parent[this.property][this.index] = newNode;
          } else {
            this.parent[this.property] = newNode;
          }
          return NodePath2.getForNode(newNode, this.parentPath, this.property, this.index);
        }
      }, {
        key: "update",
        value: function update(nodeProps) {
          Object.assign(this.node, nodeProps);
        }
      }, {
        key: "getParent",
        value: function getParent() {
          return this.parentPath;
        }
      }, {
        key: "getChild",
        value: function getChild2() {
          var n = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
          if (this.node.expressions) {
            return NodePath2.getForNode(this.node.expressions[n], this, DEFAULT_COLLECTION_PROP, n);
          } else if (this.node.expression && n == 0) {
            return NodePath2.getForNode(this.node.expression, this, DEFAULT_SINGLE_PROP);
          }
          return null;
        }
      }, {
        key: "hasEqualSource",
        value: function hasEqualSource(path) {
          return JSON.stringify(this.node, jsonSkipLoc) === JSON.stringify(path.node, jsonSkipLoc);
        }
      }, {
        key: "jsonEncode",
        value: function jsonEncode() {
          var _ref = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, format = _ref.format, useLoc = _ref.useLoc;
          return JSON.stringify(this.node, useLoc ? null : jsonSkipLoc, format);
        }
      }, {
        key: "getPreviousSibling",
        value: function getPreviousSibling() {
          if (!this.parent || this.index == null) {
            return null;
          }
          return NodePath2.getForNode(this.parent[this.property][this.index - 1], NodePath2.getForNode(this.parent), this.property, this.index - 1);
        }
      }, {
        key: "getNextSibling",
        value: function getNextSibling() {
          if (!this.parent || this.index == null) {
            return null;
          }
          return NodePath2.getForNode(this.parent[this.property][this.index + 1], NodePath2.getForNode(this.parent), this.property, this.index + 1);
        }
      }], [{
        key: "getForNode",
        value: function getForNode(node) {
          var parentPath = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
          var prop = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : null;
          var index2 = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : -1;
          if (!node) {
            return null;
          }
          if (!NodePath2.registry.has(node)) {
            NodePath2.registry.set(node, new NodePath2(node, parentPath, prop, index2 == -1 ? null : index2));
          }
          var path = NodePath2.registry.get(node);
          if (parentPath !== null) {
            path.parentPath = parentPath;
            path.parent = path.parentPath.node;
          }
          if (prop !== null) {
            path.property = prop;
          }
          if (index2 >= 0) {
            path.index = index2;
          }
          return path;
        }
      }, {
        key: "initRegistry",
        value: function initRegistry() {
          if (!NodePath2.registry) {
            NodePath2.registry = new Map();
          }
          NodePath2.registry.clear();
        }
      }, {
        key: "updateTraversingIndex",
        value: function updateTraversingIndex(dx) {
          return NodePath2.traversingIndexStack[NodePath2.traversingIndexStack.length - 1] += dx;
        }
      }, {
        key: "getTraversingIndex",
        value: function getTraversingIndex() {
          return NodePath2.traversingIndexStack[NodePath2.traversingIndexStack.length - 1];
        }
      }]);
      return NodePath2;
    }();
    NodePath.initRegistry();
    NodePath.traversingIndexStack = [];
    function jsonSkipLoc(prop, value) {
      if (prop === "loc") {
        return void 0;
      }
      return value;
    }
    module2.exports = NodePath;
  }
});

// node_modules/regexp-tree/dist/traverse/index.js
var require_traverse = __commonJS({
  "node_modules/regexp-tree/dist/traverse/index.js"(exports, module2) {
    "use strict";
    var NodePath = require_node_path();
    function astTraverse(root) {
      var options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      var pre = options.pre;
      var post = options.post;
      var skipProperty = options.skipProperty;
      function visit(node, parent, prop, idx) {
        if (!node || typeof node.type !== "string") {
          return;
        }
        var res = void 0;
        if (pre) {
          res = pre(node, parent, prop, idx);
        }
        if (res !== false) {
          if (parent && parent[prop]) {
            if (!isNaN(idx)) {
              node = parent[prop][idx];
            } else {
              node = parent[prop];
            }
          }
          for (var _prop in node) {
            if (node.hasOwnProperty(_prop)) {
              if (skipProperty ? skipProperty(_prop, node) : _prop[0] === "$") {
                continue;
              }
              var child = node[_prop];
              if (Array.isArray(child)) {
                var index2 = 0;
                NodePath.traversingIndexStack.push(index2);
                while (index2 < child.length) {
                  visit(child[index2], node, _prop, index2);
                  index2 = NodePath.updateTraversingIndex(1);
                }
                NodePath.traversingIndexStack.pop();
              } else {
                visit(child, node, _prop);
              }
            }
          }
        }
        if (post) {
          post(node, parent, prop, idx);
        }
      }
      visit(root, null);
    }
    module2.exports = {
      traverse: function traverse(ast, handlers) {
        var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : { asNodes: false };
        if (!Array.isArray(handlers)) {
          handlers = [handlers];
        }
        handlers = handlers.filter(function(handler) {
          if (typeof handler.shouldRun !== "function") {
            return true;
          }
          return handler.shouldRun(ast);
        });
        NodePath.initRegistry();
        handlers.forEach(function(handler) {
          if (typeof handler.init === "function") {
            handler.init(ast);
          }
        });
        function getPathFor(node, parent, prop, index2) {
          var parentPath = NodePath.getForNode(parent);
          var nodePath = NodePath.getForNode(node, parentPath, prop, index2);
          return nodePath;
        }
        astTraverse(ast, {
          pre: function pre(node, parent, prop, index2) {
            var nodePath = void 0;
            if (!options.asNodes) {
              nodePath = getPathFor(node, parent, prop, index2);
            }
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = void 0;
            try {
              for (var _iterator = handlers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var handler = _step.value;
                if (typeof handler["*"] === "function") {
                  if (nodePath) {
                    if (!nodePath.isRemoved()) {
                      var handlerResult = handler["*"](nodePath);
                      if (handlerResult === false) {
                        return false;
                      }
                    }
                  } else {
                    handler["*"](node, parent, prop, index2);
                  }
                }
                var handlerFuncPre = void 0;
                if (typeof handler[node.type] === "function") {
                  handlerFuncPre = handler[node.type];
                } else if (typeof handler[node.type] === "object" && typeof handler[node.type].pre === "function") {
                  handlerFuncPre = handler[node.type].pre;
                }
                if (handlerFuncPre) {
                  if (nodePath) {
                    if (!nodePath.isRemoved()) {
                      var _handlerResult = handlerFuncPre.call(handler, nodePath);
                      if (_handlerResult === false) {
                        return false;
                      }
                    }
                  } else {
                    handlerFuncPre.call(handler, node, parent, prop, index2);
                  }
                }
              }
            } catch (err) {
              _didIteratorError = true;
              _iteratorError = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }
              } finally {
                if (_didIteratorError) {
                  throw _iteratorError;
                }
              }
            }
          },
          post: function post(node, parent, prop, index2) {
            if (!node) {
              return;
            }
            var nodePath = void 0;
            if (!options.asNodes) {
              nodePath = getPathFor(node, parent, prop, index2);
            }
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = void 0;
            try {
              for (var _iterator2 = handlers[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var handler = _step2.value;
                var handlerFuncPost = void 0;
                if (typeof handler[node.type] === "object" && typeof handler[node.type].post === "function") {
                  handlerFuncPost = handler[node.type].post;
                }
                if (handlerFuncPost) {
                  if (nodePath) {
                    if (!nodePath.isRemoved()) {
                      var handlerResult = handlerFuncPost.call(handler, nodePath);
                      if (handlerResult === false) {
                        return false;
                      }
                    }
                  } else {
                    handlerFuncPost.call(handler, node, parent, prop, index2);
                  }
                }
              }
            } catch (err) {
              _didIteratorError2 = true;
              _iteratorError2 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                  _iterator2.return();
                }
              } finally {
                if (_didIteratorError2) {
                  throw _iteratorError2;
                }
              }
            }
          },
          skipProperty: function skipProperty(prop) {
            return prop === "loc";
          }
        });
      }
    };
  }
});

// node_modules/regexp-tree/dist/transform/index.js
var require_transform = __commonJS({
  "node_modules/regexp-tree/dist/transform/index.js"(exports, module2) {
    "use strict";
    var _createClass = function() {
      function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
          var descriptor = props[i];
          descriptor.enumerable = descriptor.enumerable || false;
          descriptor.configurable = true;
          if ("value" in descriptor)
            descriptor.writable = true;
          Object.defineProperty(target, descriptor.key, descriptor);
        }
      }
      return function(Constructor, protoProps, staticProps) {
        if (protoProps)
          defineProperties(Constructor.prototype, protoProps);
        if (staticProps)
          defineProperties(Constructor, staticProps);
        return Constructor;
      };
    }();
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    var generator = require_generator();
    var parser2 = require_parser();
    var traverse = require_traverse();
    var TransformResult = function() {
      function TransformResult2(ast) {
        var extra = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
        _classCallCheck(this, TransformResult2);
        this._ast = ast;
        this._source = null;
        this._string = null;
        this._regexp = null;
        this._extra = extra;
      }
      _createClass(TransformResult2, [{
        key: "getAST",
        value: function getAST() {
          return this._ast;
        }
      }, {
        key: "setExtra",
        value: function setExtra(extra) {
          this._extra = extra;
        }
      }, {
        key: "getExtra",
        value: function getExtra() {
          return this._extra;
        }
      }, {
        key: "toRegExp",
        value: function toRegExp() {
          if (!this._regexp) {
            this._regexp = new RegExp(this.getSource(), this._ast.flags);
          }
          return this._regexp;
        }
      }, {
        key: "getSource",
        value: function getSource() {
          if (!this._source) {
            this._source = generator.generate(this._ast.body);
          }
          return this._source;
        }
      }, {
        key: "getFlags",
        value: function getFlags() {
          return this._ast.flags;
        }
      }, {
        key: "toString",
        value: function toString() {
          if (!this._string) {
            this._string = generator.generate(this._ast);
          }
          return this._string;
        }
      }]);
      return TransformResult2;
    }();
    module2.exports = {
      TransformResult,
      transform: function transform(regexp, handlers) {
        var ast = regexp;
        if (regexp instanceof RegExp) {
          regexp = "" + regexp;
        }
        if (typeof regexp === "string") {
          ast = parser2.parse(regexp, {
            captureLocations: true
          });
        }
        traverse.traverse(ast, handlers);
        return new TransformResult(ast);
      }
    };
  }
});

// node_modules/regexp-tree/dist/compat-transpiler/index.js
var require_compat_transpiler = __commonJS({
  "node_modules/regexp-tree/dist/compat-transpiler/index.js"(exports, module2) {
    "use strict";
    var compatTransforms = require_transforms();
    var _transform = require_transform();
    module2.exports = {
      transform: function transform(regexp) {
        var transformsWhitelist = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : [];
        var transformToApply = transformsWhitelist.length > 0 ? transformsWhitelist : Object.keys(compatTransforms);
        var result = void 0;
        var extra = {};
        transformToApply.forEach(function(transformName) {
          if (!compatTransforms.hasOwnProperty(transformName)) {
            throw new Error("Unknown compat-transform: " + transformName + ". Available transforms are: " + Object.keys(compatTransforms).join(", "));
          }
          var handler = compatTransforms[transformName];
          result = _transform.transform(regexp, handler);
          regexp = result.getAST();
          if (typeof handler.getExtra === "function") {
            extra[transformName] = handler.getExtra();
          }
        });
        result.setExtra(extra);
        return result;
      }
    };
  }
});

// node_modules/regexp-tree/dist/utils/clone.js
var require_clone = __commonJS({
  "node_modules/regexp-tree/dist/utils/clone.js"(exports, module2) {
    "use strict";
    module2.exports = function clone2(obj) {
      if (obj === null || typeof obj !== "object") {
        return obj;
      }
      var res = void 0;
      if (Array.isArray(obj)) {
        res = [];
      } else {
        res = {};
      }
      for (var i in obj) {
        res[i] = clone2(obj[i]);
      }
      return res;
    };
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/char-surrogate-pair-to-single-unicode-transform.js
var require_char_surrogate_pair_to_single_unicode_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/char-surrogate-pair-to-single-unicode-transform.js"(exports, module2) {
    "use strict";
    module2.exports = {
      shouldRun: function shouldRun(ast) {
        return ast.flags.includes("u");
      },
      Char: function Char(path) {
        var node = path.node;
        if (node.kind !== "unicode" || !node.isSurrogatePair || isNaN(node.codePoint)) {
          return;
        }
        node.value = "\\u{" + node.codePoint.toString(16) + "}";
        delete node.isSurrogatePair;
      }
    };
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/char-code-to-simple-char-transform.js
var require_char_code_to_simple_char_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/char-code-to-simple-char-transform.js"(exports, module2) {
    "use strict";
    var UPPER_A_CP = "A".codePointAt(0);
    var UPPER_Z_CP = "Z".codePointAt(0);
    var LOWER_A_CP = "a".codePointAt(0);
    var LOWER_Z_CP = "z".codePointAt(0);
    var DIGIT_0_CP = "0".codePointAt(0);
    var DIGIT_9_CP = "9".codePointAt(0);
    module2.exports = {
      Char: function Char(path) {
        var node = path.node, parent = path.parent;
        if (isNaN(node.codePoint) || node.kind === "simple") {
          return;
        }
        if (parent.type === "ClassRange") {
          if (!isSimpleRange(parent)) {
            return;
          }
        }
        if (!isPrintableASCIIChar(node.codePoint)) {
          return;
        }
        var symbol = String.fromCodePoint(node.codePoint);
        var newChar = {
          type: "Char",
          kind: "simple",
          value: symbol,
          symbol,
          codePoint: node.codePoint
        };
        if (needsEscape(symbol, parent.type)) {
          newChar.escaped = true;
        }
        path.replace(newChar);
      }
    };
    function isSimpleRange(classRange) {
      var from = classRange.from, to = classRange.to;
      return from.codePoint >= DIGIT_0_CP && from.codePoint <= DIGIT_9_CP && to.codePoint >= DIGIT_0_CP && to.codePoint <= DIGIT_9_CP || from.codePoint >= UPPER_A_CP && from.codePoint <= UPPER_Z_CP && to.codePoint >= UPPER_A_CP && to.codePoint <= UPPER_Z_CP || from.codePoint >= LOWER_A_CP && from.codePoint <= LOWER_Z_CP && to.codePoint >= LOWER_A_CP && to.codePoint <= LOWER_Z_CP;
    }
    function isPrintableASCIIChar(codePoint) {
      return codePoint >= 32 && codePoint <= 126;
    }
    function needsEscape(symbol, parentType) {
      if (parentType === "ClassRange" || parentType === "CharacterClass") {
        return /[\]\\^-]/.test(symbol);
      }
      return /[*[()+?^$./\\|{}]/.test(symbol);
    }
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/char-case-insensitive-lowercase-transform.js
var require_char_case_insensitive_lowercase_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/char-case-insensitive-lowercase-transform.js"(exports, module2) {
    "use strict";
    var UPPER_A_CP = "A".codePointAt(0);
    var UPPER_Z_CP = "Z".codePointAt(0);
    module2.exports = {
      _AZClassRanges: null,
      _hasUFlag: false,
      init: function init(ast) {
        this._AZClassRanges = new Set();
        this._hasUFlag = ast.flags.includes("u");
      },
      shouldRun: function shouldRun(ast) {
        return ast.flags.includes("i");
      },
      Char: function Char(path) {
        var node = path.node, parent = path.parent;
        if (isNaN(node.codePoint)) {
          return;
        }
        if (!this._hasUFlag && node.codePoint >= 4096) {
          return;
        }
        if (parent.type === "ClassRange") {
          if (!this._AZClassRanges.has(parent) && !isAZClassRange(parent)) {
            return;
          }
          this._AZClassRanges.add(parent);
        }
        var lower = node.symbol.toLowerCase();
        if (lower !== node.symbol) {
          node.value = displaySymbolAsValue(lower, node);
          node.symbol = lower;
          node.codePoint = lower.codePointAt(0);
        }
      }
    };
    function isAZClassRange(classRange) {
      var from = classRange.from, to = classRange.to;
      return from.codePoint >= UPPER_A_CP && from.codePoint <= UPPER_Z_CP && to.codePoint >= UPPER_A_CP && to.codePoint <= UPPER_Z_CP;
    }
    function displaySymbolAsValue(symbol, node) {
      var codePoint = symbol.codePointAt(0);
      if (node.kind === "decimal") {
        return "\\" + codePoint;
      }
      if (node.kind === "oct") {
        return "\\0" + codePoint.toString(8);
      }
      if (node.kind === "hex") {
        return "\\x" + codePoint.toString(16);
      }
      if (node.kind === "unicode") {
        if (node.isSurrogatePair) {
          var _getSurrogatePairFrom = getSurrogatePairFromCodePoint(codePoint), lead = _getSurrogatePairFrom.lead, trail = _getSurrogatePairFrom.trail;
          return "\\u" + "0".repeat(4 - lead.length) + lead + "\\u" + "0".repeat(4 - trail.length) + trail;
        } else if (node.value.includes("{")) {
          return "\\u{" + codePoint.toString(16) + "}";
        } else {
          var code = codePoint.toString(16);
          return "\\u" + "0".repeat(4 - code.length) + code;
        }
      }
      return symbol;
    }
    function getSurrogatePairFromCodePoint(codePoint) {
      var lead = Math.floor((codePoint - 65536) / 1024) + 55296;
      var trail = (codePoint - 65536) % 1024 + 56320;
      return {
        lead: lead.toString(16),
        trail: trail.toString(16)
      };
    }
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/char-class-remove-duplicates-transform.js
var require_char_class_remove_duplicates_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/char-class-remove-duplicates-transform.js"(exports, module2) {
    "use strict";
    module2.exports = {
      CharacterClass: function CharacterClass(path) {
        var node = path.node;
        var sources = {};
        for (var i = 0; i < node.expressions.length; i++) {
          var childPath = path.getChild(i);
          var source = childPath.jsonEncode();
          if (sources.hasOwnProperty(source)) {
            childPath.remove();
            i--;
          }
          sources[source] = true;
        }
      }
    };
  }
});

// node_modules/regexp-tree/dist/transform/utils.js
var require_utils = __commonJS({
  "node_modules/regexp-tree/dist/transform/utils.js"(exports, module2) {
    "use strict";
    function _toConsumableArray(arr) {
      if (Array.isArray(arr)) {
        for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
          arr2[i] = arr[i];
        }
        return arr2;
      } else {
        return Array.from(arr);
      }
    }
    function disjunctionToList(node) {
      if (node.type !== "Disjunction") {
        throw new TypeError('Expected "Disjunction" node, got "' + node.type + '"');
      }
      var list = [];
      if (node.left && node.left.type === "Disjunction") {
        list.push.apply(list, _toConsumableArray(disjunctionToList(node.left)).concat([node.right]));
      } else {
        list.push(node.left, node.right);
      }
      return list;
    }
    function listToDisjunction(list) {
      return list.reduce(function(left, right) {
        return {
          type: "Disjunction",
          left,
          right
        };
      });
    }
    function increaseQuantifierByOne(quantifier) {
      if (quantifier.kind === "*") {
        quantifier.kind = "+";
      } else if (quantifier.kind === "+") {
        quantifier.kind = "Range";
        quantifier.from = 2;
        delete quantifier.to;
      } else if (quantifier.kind === "?") {
        quantifier.kind = "Range";
        quantifier.from = 1;
        quantifier.to = 2;
      } else if (quantifier.kind === "Range") {
        quantifier.from += 1;
        if (quantifier.to) {
          quantifier.to += 1;
        }
      }
    }
    module2.exports = {
      disjunctionToList,
      listToDisjunction,
      increaseQuantifierByOne
    };
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/quantifiers-merge-transform.js
var require_quantifiers_merge_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/quantifiers-merge-transform.js"(exports, module2) {
    "use strict";
    var _require = require_utils();
    var increaseQuantifierByOne = _require.increaseQuantifierByOne;
    module2.exports = {
      Repetition: function Repetition(path) {
        var node = path.node, parent = path.parent;
        if (parent.type !== "Alternative" || !path.index) {
          return;
        }
        var previousSibling = path.getPreviousSibling();
        if (!previousSibling) {
          return;
        }
        if (previousSibling.node.type === "Repetition") {
          if (!previousSibling.getChild().hasEqualSource(path.getChild())) {
            return;
          }
          var _extractFromTo = extractFromTo(previousSibling.node.quantifier), previousSiblingFrom = _extractFromTo.from, previousSiblingTo = _extractFromTo.to;
          var _extractFromTo2 = extractFromTo(node.quantifier), nodeFrom = _extractFromTo2.from, nodeTo = _extractFromTo2.to;
          if (previousSibling.node.quantifier.greedy !== node.quantifier.greedy && !isGreedyOpenRange(previousSibling.node.quantifier) && !isGreedyOpenRange(node.quantifier)) {
            return;
          }
          node.quantifier.kind = "Range";
          node.quantifier.from = previousSiblingFrom + nodeFrom;
          if (previousSiblingTo && nodeTo) {
            node.quantifier.to = previousSiblingTo + nodeTo;
          } else {
            delete node.quantifier.to;
          }
          if (isGreedyOpenRange(previousSibling.node.quantifier) || isGreedyOpenRange(node.quantifier)) {
            node.quantifier.greedy = true;
          }
          previousSibling.remove();
        } else {
          if (!previousSibling.hasEqualSource(path.getChild())) {
            return;
          }
          increaseQuantifierByOne(node.quantifier);
          previousSibling.remove();
        }
      }
    };
    function isGreedyOpenRange(quantifier) {
      return quantifier.greedy && (quantifier.kind === "+" || quantifier.kind === "*" || quantifier.kind === "Range" && !quantifier.to);
    }
    function extractFromTo(quantifier) {
      var from = void 0, to = void 0;
      if (quantifier.kind === "*") {
        from = 0;
      } else if (quantifier.kind === "+") {
        from = 1;
      } else if (quantifier.kind === "?") {
        from = 0;
        to = 1;
      } else {
        from = quantifier.from;
        if (quantifier.to) {
          to = quantifier.to;
        }
      }
      return { from, to };
    }
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/quantifier-range-to-symbol-transform.js
var require_quantifier_range_to_symbol_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/quantifier-range-to-symbol-transform.js"(exports, module2) {
    "use strict";
    module2.exports = {
      Quantifier: function Quantifier(path) {
        var node = path.node;
        if (node.kind !== "Range") {
          return;
        }
        rewriteOpenZero(path);
        rewriteOpenOne(path);
        rewriteExactOne(path);
      }
    };
    function rewriteOpenZero(path) {
      var node = path.node;
      if (node.from !== 0 || node.to) {
        return;
      }
      node.kind = "*";
      delete node.from;
    }
    function rewriteOpenOne(path) {
      var node = path.node;
      if (node.from !== 1 || node.to) {
        return;
      }
      node.kind = "+";
      delete node.from;
    }
    function rewriteExactOne(path) {
      var node = path.node;
      if (node.from !== 1 || node.to !== 1) {
        return;
      }
      path.parentPath.replace(path.parentPath.node.expression);
    }
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/char-class-classranges-to-chars-transform.js
var require_char_class_classranges_to_chars_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/char-class-classranges-to-chars-transform.js"(exports, module2) {
    "use strict";
    module2.exports = {
      ClassRange: function ClassRange(path) {
        var node = path.node;
        if (node.from.codePoint === node.to.codePoint) {
          path.replace(node.from);
        } else if (node.from.codePoint === node.to.codePoint - 1) {
          path.getParent().insertChildAt(node.to, path.index + 1);
          path.replace(node.from);
        }
      }
    };
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/char-class-to-meta-transform.js
var require_char_class_to_meta_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/char-class-to-meta-transform.js"(exports, module2) {
    "use strict";
    function _toConsumableArray(arr) {
      if (Array.isArray(arr)) {
        for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
          arr2[i] = arr[i];
        }
        return arr2;
      } else {
        return Array.from(arr);
      }
    }
    module2.exports = {
      _hasIFlag: false,
      _hasUFlag: false,
      init: function init(ast) {
        this._hasIFlag = ast.flags.includes("i");
        this._hasUFlag = ast.flags.includes("u");
      },
      CharacterClass: function CharacterClass(path) {
        rewriteNumberRanges(path);
        rewriteWordRanges(path, this._hasIFlag, this._hasUFlag);
        rewriteWhitespaceRanges(path);
      }
    };
    function rewriteNumberRanges(path) {
      var node = path.node;
      node.expressions.forEach(function(expression, i) {
        if (isFullNumberRange(expression)) {
          path.getChild(i).replace({
            type: "Char",
            value: "\\d",
            kind: "meta"
          });
        }
      });
    }
    function rewriteWordRanges(path, hasIFlag, hasUFlag) {
      var node = path.node;
      var numberPath = null;
      var lowerCasePath = null;
      var upperCasePath = null;
      var underscorePath = null;
      var u017fPath = null;
      var u212aPath = null;
      node.expressions.forEach(function(expression, i) {
        if (isMetaChar(expression, "\\d")) {
          numberPath = path.getChild(i);
        } else if (isLowerCaseRange(expression)) {
          lowerCasePath = path.getChild(i);
        } else if (isUpperCaseRange(expression)) {
          upperCasePath = path.getChild(i);
        } else if (isUnderscore(expression)) {
          underscorePath = path.getChild(i);
        } else if (hasIFlag && hasUFlag && isCodePoint(expression, 383)) {
          u017fPath = path.getChild(i);
        } else if (hasIFlag && hasUFlag && isCodePoint(expression, 8490)) {
          u212aPath = path.getChild(i);
        }
      });
      if (numberPath && (lowerCasePath && upperCasePath || hasIFlag && (lowerCasePath || upperCasePath)) && underscorePath && (!hasUFlag || !hasIFlag || u017fPath && u212aPath)) {
        numberPath.replace({
          type: "Char",
          value: "\\w",
          kind: "meta"
        });
        if (lowerCasePath) {
          lowerCasePath.remove();
        }
        if (upperCasePath) {
          upperCasePath.remove();
        }
        underscorePath.remove();
        if (u017fPath) {
          u017fPath.remove();
        }
        if (u212aPath) {
          u212aPath.remove();
        }
      }
    }
    var whitespaceRangeTests = [function(node) {
      return isChar(node, " ");
    }].concat(_toConsumableArray(["\\f", "\\n", "\\r", "\\t", "\\v"].map(function(char) {
      return function(node) {
        return isMetaChar(node, char);
      };
    })), _toConsumableArray([160, 5760, 8232, 8233, 8239, 8287, 12288, 65279].map(function(codePoint) {
      return function(node) {
        return isCodePoint(node, codePoint);
      };
    })), [function(node) {
      return node.type === "ClassRange" && isCodePoint(node.from, 8192) && isCodePoint(node.to, 8202);
    }]);
    function rewriteWhitespaceRanges(path) {
      var node = path.node;
      if (node.expressions.length < whitespaceRangeTests.length || !whitespaceRangeTests.every(function(test) {
        return node.expressions.some(function(expression) {
          return test(expression);
        });
      })) {
        return;
      }
      var nNode = node.expressions.find(function(expression) {
        return isMetaChar(expression, "\\n");
      });
      nNode.value = "\\s";
      nNode.symbol = void 0;
      nNode.codePoint = NaN;
      node.expressions.map(function(expression, i) {
        return whitespaceRangeTests.some(function(test) {
          return test(expression);
        }) ? path.getChild(i) : void 0;
      }).filter(Boolean).forEach(function(path2) {
        return path2.remove();
      });
    }
    function isFullNumberRange(node) {
      return node.type === "ClassRange" && node.from.value === "0" && node.to.value === "9";
    }
    function isChar(node, value) {
      var kind = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : "simple";
      return node.type === "Char" && node.value === value && node.kind === kind;
    }
    function isMetaChar(node, value) {
      return isChar(node, value, "meta");
    }
    function isLowerCaseRange(node) {
      return node.type === "ClassRange" && node.from.value === "a" && node.to.value === "z";
    }
    function isUpperCaseRange(node) {
      return node.type === "ClassRange" && node.from.value === "A" && node.to.value === "Z";
    }
    function isUnderscore(node) {
      return node.type === "Char" && node.value === "_" && node.kind === "simple";
    }
    function isCodePoint(node, codePoint) {
      return node.type === "Char" && node.kind === "unicode" && node.codePoint === codePoint;
    }
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/char-class-to-single-char-transform.js
var require_char_class_to_single_char_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/char-class-to-single-char-transform.js"(exports, module2) {
    "use strict";
    module2.exports = {
      CharacterClass: function CharacterClass(path) {
        var node = path.node;
        if (node.expressions.length !== 1 || !hasAppropriateSiblings(path) || !isAppropriateChar(node.expressions[0])) {
          return;
        }
        var _node$expressions$ = node.expressions[0], value = _node$expressions$.value, kind = _node$expressions$.kind, escaped = _node$expressions$.escaped;
        if (node.negative) {
          if (!isMeta(value)) {
            return;
          }
          value = getInverseMeta(value);
        }
        path.replace({
          type: "Char",
          value,
          kind,
          escaped: escaped || shouldEscape(value)
        });
      }
    };
    function isAppropriateChar(node) {
      return node.type === "Char" && node.value !== "\\b";
    }
    function isMeta(value) {
      return /^\\[dwsDWS]$/.test(value);
    }
    function getInverseMeta(value) {
      return /[dws]/.test(value) ? value.toUpperCase() : value.toLowerCase();
    }
    function hasAppropriateSiblings(path) {
      var parent = path.parent, index2 = path.index;
      if (parent.type !== "Alternative") {
        return true;
      }
      var previousNode = parent.expressions[index2 - 1];
      if (previousNode == null) {
        return true;
      }
      if (previousNode.type === "Backreference" && previousNode.kind === "number") {
        return false;
      }
      if (previousNode.type === "Char" && previousNode.kind === "decimal") {
        return false;
      }
      return true;
    }
    function shouldEscape(value) {
      return /[*[()+?$./{}|]/.test(value);
    }
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/char-escape-unescape-transform.js
var require_char_escape_unescape_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/char-escape-unescape-transform.js"(exports, module2) {
    "use strict";
    module2.exports = {
      _hasXFlag: false,
      init: function init(ast) {
        this._hasXFlag = ast.flags.includes("x");
      },
      Char: function Char(path) {
        var node = path.node;
        if (!node.escaped) {
          return;
        }
        if (shouldUnescape(path, this._hasXFlag)) {
          delete node.escaped;
        }
      }
    };
    function shouldUnescape(path, hasXFlag) {
      var value = path.node.value, index2 = path.index, parent = path.parent;
      if (parent.type !== "CharacterClass" && parent.type !== "ClassRange") {
        return !preservesEscape(value, index2, parent, hasXFlag);
      }
      return !preservesInCharClass(value, index2, parent);
    }
    function preservesInCharClass(value, index2, parent) {
      if (value === "^") {
        return index2 === 0 && !parent.negative;
      }
      if (value === "-") {
        return true;
      }
      return /[\]\\]/.test(value);
    }
    function preservesEscape(value, index2, parent, hasXFlag) {
      if (value === "{") {
        return preservesOpeningCurlyBraceEscape(index2, parent);
      }
      if (value === "}") {
        return preservesClosingCurlyBraceEscape(index2, parent);
      }
      if (hasXFlag && /[ #]/.test(value)) {
        return true;
      }
      return /[*[()+?^$./\\|]/.test(value);
    }
    function consumeNumbers(startIndex, parent, rtl) {
      var i = startIndex;
      var siblingNode = (rtl ? i >= 0 : i < parent.expressions.length) && parent.expressions[i];
      while (siblingNode && siblingNode.type === "Char" && siblingNode.kind === "simple" && !siblingNode.escaped && /\d/.test(siblingNode.value)) {
        rtl ? i-- : i++;
        siblingNode = (rtl ? i >= 0 : i < parent.expressions.length) && parent.expressions[i];
      }
      return Math.abs(startIndex - i);
    }
    function isSimpleChar(node, value) {
      return node && node.type === "Char" && node.kind === "simple" && !node.escaped && node.value === value;
    }
    function preservesOpeningCurlyBraceEscape(index2, parent) {
      if (index2 == null) {
        return false;
      }
      var nbFollowingNumbers = consumeNumbers(index2 + 1, parent);
      var i = index2 + nbFollowingNumbers + 1;
      var nextSiblingNode = i < parent.expressions.length && parent.expressions[i];
      if (nbFollowingNumbers) {
        if (isSimpleChar(nextSiblingNode, "}")) {
          return true;
        }
        if (isSimpleChar(nextSiblingNode, ",")) {
          nbFollowingNumbers = consumeNumbers(i + 1, parent);
          i = i + nbFollowingNumbers + 1;
          nextSiblingNode = i < parent.expressions.length && parent.expressions[i];
          return isSimpleChar(nextSiblingNode, "}");
        }
      }
      return false;
    }
    function preservesClosingCurlyBraceEscape(index2, parent) {
      if (index2 == null) {
        return false;
      }
      var nbPrecedingNumbers = consumeNumbers(index2 - 1, parent, true);
      var i = index2 - nbPrecedingNumbers - 1;
      var previousSiblingNode = i >= 0 && parent.expressions[i];
      if (nbPrecedingNumbers && isSimpleChar(previousSiblingNode, "{")) {
        return true;
      }
      if (isSimpleChar(previousSiblingNode, ",")) {
        nbPrecedingNumbers = consumeNumbers(i - 1, parent, true);
        i = i - nbPrecedingNumbers - 1;
        previousSiblingNode = i < parent.expressions.length && parent.expressions[i];
        return nbPrecedingNumbers && isSimpleChar(previousSiblingNode, "{");
      }
      return false;
    }
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/char-class-classranges-merge-transform.js
var require_char_class_classranges_merge_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/char-class-classranges-merge-transform.js"(exports, module2) {
    "use strict";
    module2.exports = {
      _hasIUFlags: false,
      init: function init(ast) {
        this._hasIUFlags = ast.flags.includes("i") && ast.flags.includes("u");
      },
      CharacterClass: function CharacterClass(path) {
        var node = path.node;
        var expressions = node.expressions;
        var metas = [];
        expressions.forEach(function(expression2) {
          if (isMeta(expression2)) {
            metas.push(expression2.value);
          }
        });
        expressions.sort(sortCharClass);
        for (var i = 0; i < expressions.length; i++) {
          var expression = expressions[i];
          if (fitsInMetas(expression, metas, this._hasIUFlags) || combinesWithPrecedingClassRange(expression, expressions[i - 1]) || combinesWithFollowingClassRange(expression, expressions[i + 1])) {
            expressions.splice(i, 1);
            i--;
          } else {
            var nbMergedChars = charCombinesWithPrecedingChars(expression, i, expressions);
            expressions.splice(i - nbMergedChars + 1, nbMergedChars);
            i -= nbMergedChars;
          }
        }
      }
    };
    function sortCharClass(a, b) {
      var aValue = getSortValue(a);
      var bValue = getSortValue(b);
      if (aValue === bValue) {
        if (a.type === "ClassRange" && b.type !== "ClassRange") {
          return -1;
        }
        if (b.type === "ClassRange" && a.type !== "ClassRange") {
          return 1;
        }
        if (a.type === "ClassRange" && b.type === "ClassRange") {
          return getSortValue(a.to) - getSortValue(b.to);
        }
        if (isMeta(a) && isMeta(b) || isControl(a) && isControl(b)) {
          return a.value < b.value ? -1 : 1;
        }
      }
      return aValue - bValue;
    }
    function getSortValue(expression) {
      if (expression.type === "Char") {
        if (expression.value === "-") {
          return Infinity;
        }
        if (expression.kind === "control") {
          return Infinity;
        }
        if (expression.kind === "meta" && isNaN(expression.codePoint)) {
          return -1;
        }
        return expression.codePoint;
      }
      return expression.from.codePoint;
    }
    function isMeta(expression) {
      var value = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
      return expression.type === "Char" && expression.kind === "meta" && (value ? expression.value === value : /^\\[dws]$/i.test(expression.value));
    }
    function isControl(expression) {
      return expression.type === "Char" && expression.kind === "control";
    }
    function fitsInMetas(expression, metas, hasIUFlags) {
      for (var i = 0; i < metas.length; i++) {
        if (fitsInMeta(expression, metas[i], hasIUFlags)) {
          return true;
        }
      }
      return false;
    }
    function fitsInMeta(expression, meta, hasIUFlags) {
      if (expression.type === "ClassRange") {
        return fitsInMeta(expression.from, meta, hasIUFlags) && fitsInMeta(expression.to, meta, hasIUFlags);
      }
      if (meta === "\\S" && (isMeta(expression, "\\w") || isMeta(expression, "\\d"))) {
        return true;
      }
      if (meta === "\\D" && (isMeta(expression, "\\W") || isMeta(expression, "\\s"))) {
        return true;
      }
      if (meta === "\\w" && isMeta(expression, "\\d")) {
        return true;
      }
      if (meta === "\\W" && isMeta(expression, "\\s")) {
        return true;
      }
      if (expression.type !== "Char" || isNaN(expression.codePoint)) {
        return false;
      }
      if (meta === "\\s") {
        return fitsInMetaS(expression);
      }
      if (meta === "\\S") {
        return !fitsInMetaS(expression);
      }
      if (meta === "\\d") {
        return fitsInMetaD(expression);
      }
      if (meta === "\\D") {
        return !fitsInMetaD(expression);
      }
      if (meta === "\\w") {
        return fitsInMetaW(expression, hasIUFlags);
      }
      if (meta === "\\W") {
        return !fitsInMetaW(expression, hasIUFlags);
      }
      return false;
    }
    function fitsInMetaS(expression) {
      return expression.codePoint === 9 || expression.codePoint === 10 || expression.codePoint === 11 || expression.codePoint === 12 || expression.codePoint === 13 || expression.codePoint === 32 || expression.codePoint === 160 || expression.codePoint === 5760 || expression.codePoint >= 8192 && expression.codePoint <= 8202 || expression.codePoint === 8232 || expression.codePoint === 8233 || expression.codePoint === 8239 || expression.codePoint === 8287 || expression.codePoint === 12288 || expression.codePoint === 65279;
    }
    function fitsInMetaD(expression) {
      return expression.codePoint >= 48 && expression.codePoint <= 57;
    }
    function fitsInMetaW(expression, hasIUFlags) {
      return fitsInMetaD(expression) || expression.codePoint >= 65 && expression.codePoint <= 90 || expression.codePoint >= 97 && expression.codePoint <= 122 || expression.value === "_" || hasIUFlags && (expression.codePoint === 383 || expression.codePoint === 8490);
    }
    function combinesWithPrecedingClassRange(expression, classRange) {
      if (classRange && classRange.type === "ClassRange") {
        if (fitsInClassRange(expression, classRange)) {
          return true;
        } else if (isMetaWCharOrCode(expression) && classRange.to.codePoint === expression.codePoint - 1) {
          classRange.to = expression;
          return true;
        } else if (expression.type === "ClassRange" && expression.from.codePoint <= classRange.to.codePoint + 1 && expression.to.codePoint >= classRange.from.codePoint - 1) {
          if (expression.from.codePoint < classRange.from.codePoint) {
            classRange.from = expression.from;
          }
          if (expression.to.codePoint > classRange.to.codePoint) {
            classRange.to = expression.to;
          }
          return true;
        }
      }
      return false;
    }
    function combinesWithFollowingClassRange(expression, classRange) {
      if (classRange && classRange.type === "ClassRange") {
        if (isMetaWCharOrCode(expression) && classRange.from.codePoint === expression.codePoint + 1) {
          classRange.from = expression;
          return true;
        }
      }
      return false;
    }
    function fitsInClassRange(expression, classRange) {
      if (expression.type === "Char" && isNaN(expression.codePoint)) {
        return false;
      }
      if (expression.type === "ClassRange") {
        return fitsInClassRange(expression.from, classRange) && fitsInClassRange(expression.to, classRange);
      }
      return expression.codePoint >= classRange.from.codePoint && expression.codePoint <= classRange.to.codePoint;
    }
    function charCombinesWithPrecedingChars(expression, index2, expressions) {
      if (!isMetaWCharOrCode(expression)) {
        return 0;
      }
      var nbMergedChars = 0;
      while (index2 > 0) {
        var currentExpression = expressions[index2];
        var precedingExpresion = expressions[index2 - 1];
        if (isMetaWCharOrCode(precedingExpresion) && precedingExpresion.codePoint === currentExpression.codePoint - 1) {
          nbMergedChars++;
          index2--;
        } else {
          break;
        }
      }
      if (nbMergedChars > 1) {
        expressions[index2] = {
          type: "ClassRange",
          from: expressions[index2],
          to: expression
        };
        return nbMergedChars;
      }
      return 0;
    }
    function isMetaWCharOrCode(expression) {
      return expression && expression.type === "Char" && !isNaN(expression.codePoint) && (fitsInMetaW(expression, false) || expression.kind === "unicode" || expression.kind === "hex" || expression.kind === "oct" || expression.kind === "decimal");
    }
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/disjunction-remove-duplicates-transform.js
var require_disjunction_remove_duplicates_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/disjunction-remove-duplicates-transform.js"(exports, module2) {
    "use strict";
    var NodePath = require_node_path();
    var _require = require_utils();
    var disjunctionToList = _require.disjunctionToList;
    var listToDisjunction = _require.listToDisjunction;
    module2.exports = {
      Disjunction: function Disjunction(path) {
        var node = path.node;
        var uniqueNodesMap = {};
        var parts = disjunctionToList(node).filter(function(part) {
          var encoded = part ? NodePath.getForNode(part).jsonEncode() : "null";
          if (uniqueNodesMap.hasOwnProperty(encoded)) {
            return false;
          }
          uniqueNodesMap[encoded] = part;
          return true;
        });
        path.replace(listToDisjunction(parts));
      }
    };
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/group-single-chars-to-char-class.js
var require_group_single_chars_to_char_class = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/group-single-chars-to-char-class.js"(exports, module2) {
    "use strict";
    module2.exports = {
      Disjunction: function Disjunction(path) {
        var node = path.node, parent = path.parent;
        if (!handlers[parent.type]) {
          return;
        }
        var charset = new Map();
        if (!shouldProcess(node, charset) || !charset.size) {
          return;
        }
        var characterClass = {
          type: "CharacterClass",
          expressions: Array.from(charset.keys()).sort().map(function(key) {
            return charset.get(key);
          })
        };
        handlers[parent.type](path.getParent(), characterClass);
      }
    };
    var handlers = {
      RegExp: function RegExp2(path, characterClass) {
        var node = path.node;
        node.body = characterClass;
      },
      Group: function Group(path, characterClass) {
        var node = path.node;
        if (node.capturing) {
          node.expression = characterClass;
        } else {
          path.replace(characterClass);
        }
      }
    };
    function shouldProcess(expression, charset) {
      if (!expression) {
        return false;
      }
      var type = expression.type;
      if (type === "Disjunction") {
        var left = expression.left, right = expression.right;
        return shouldProcess(left, charset) && shouldProcess(right, charset);
      } else if (type === "Char") {
        if (expression.kind === "meta" && expression.symbol === ".") {
          return false;
        }
        var value = expression.value;
        charset.set(value, expression);
        return true;
      } else if (type === "CharacterClass" && !expression.negative) {
        return expression.expressions.every(function(expression2) {
          return shouldProcess(expression2, charset);
        });
      }
      return false;
    }
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/remove-empty-group-transform.js
var require_remove_empty_group_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/remove-empty-group-transform.js"(exports, module2) {
    "use strict";
    module2.exports = {
      Group: function Group(path) {
        var node = path.node, parent = path.parent;
        var childPath = path.getChild();
        if (node.capturing || childPath) {
          return;
        }
        if (parent.type === "Repetition") {
          path.getParent().replace(node);
        } else if (parent.type !== "RegExp") {
          path.remove();
        }
      }
    };
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/ungroup-transform.js
var require_ungroup_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/ungroup-transform.js"(exports, module2) {
    "use strict";
    function _toConsumableArray(arr) {
      if (Array.isArray(arr)) {
        for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
          arr2[i] = arr[i];
        }
        return arr2;
      } else {
        return Array.from(arr);
      }
    }
    module2.exports = {
      Group: function Group(path) {
        var node = path.node, parent = path.parent;
        var childPath = path.getChild();
        if (node.capturing || !childPath) {
          return;
        }
        if (!hasAppropriateSiblings(path)) {
          return;
        }
        if (childPath.node.type === "Disjunction" && parent.type !== "RegExp") {
          return;
        }
        if (parent.type === "Repetition" && childPath.node.type !== "Char" && childPath.node.type !== "CharacterClass") {
          return;
        }
        if (childPath.node.type === "Alternative") {
          var parentPath = path.getParent();
          if (parentPath.node.type === "Alternative") {
            parentPath.replace({
              type: "Alternative",
              expressions: [].concat(_toConsumableArray(parent.expressions.slice(0, path.index)), _toConsumableArray(childPath.node.expressions), _toConsumableArray(parent.expressions.slice(path.index + 1)))
            });
          }
        } else {
          path.replace(childPath.node);
        }
      }
    };
    function hasAppropriateSiblings(path) {
      var parent = path.parent, index2 = path.index;
      if (parent.type !== "Alternative") {
        return true;
      }
      var previousNode = parent.expressions[index2 - 1];
      if (previousNode == null) {
        return true;
      }
      if (previousNode.type === "Backreference" && previousNode.kind === "number") {
        return false;
      }
      if (previousNode.type === "Char" && previousNode.kind === "decimal") {
        return false;
      }
      return true;
    }
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/combine-repeating-patterns-transform.js
var require_combine_repeating_patterns_transform = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/combine-repeating-patterns-transform.js"(exports, module2) {
    "use strict";
    function _toConsumableArray(arr) {
      if (Array.isArray(arr)) {
        for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
          arr2[i] = arr[i];
        }
        return arr2;
      } else {
        return Array.from(arr);
      }
    }
    var NodePath = require_node_path();
    var _require = require_utils();
    var increaseQuantifierByOne = _require.increaseQuantifierByOne;
    module2.exports = {
      Alternative: function Alternative(path) {
        var node = path.node;
        var index2 = 1;
        while (index2 < node.expressions.length) {
          var child = path.getChild(index2);
          index2 = Math.max(1, combineRepeatingPatternLeft(path, child, index2));
          if (index2 >= node.expressions.length) {
            break;
          }
          child = path.getChild(index2);
          index2 = Math.max(1, combineWithPreviousRepetition(path, child, index2));
          if (index2 >= node.expressions.length) {
            break;
          }
          child = path.getChild(index2);
          index2 = Math.max(1, combineRepetitionWithPrevious(path, child, index2));
          index2++;
        }
      }
    };
    function combineRepeatingPatternLeft(alternative, child, index2) {
      var node = alternative.node;
      var nbPossibleLengths = Math.ceil(index2 / 2);
      var i = 0;
      while (i < nbPossibleLengths) {
        var startIndex = index2 - 2 * i - 1;
        var right = void 0, left = void 0;
        if (i === 0) {
          right = child;
          left = alternative.getChild(startIndex);
        } else {
          right = NodePath.getForNode({
            type: "Alternative",
            expressions: [].concat(_toConsumableArray(node.expressions.slice(index2 - i, index2)), [child.node])
          });
          left = NodePath.getForNode({
            type: "Alternative",
            expressions: [].concat(_toConsumableArray(node.expressions.slice(startIndex, index2 - i)))
          });
        }
        if (right.hasEqualSource(left)) {
          for (var j = 0; j < 2 * i + 1; j++) {
            alternative.getChild(startIndex).remove();
          }
          child.replace({
            type: "Repetition",
            expression: i === 0 && right.node.type !== "Repetition" ? right.node : {
              type: "Group",
              capturing: false,
              expression: right.node
            },
            quantifier: {
              type: "Quantifier",
              kind: "Range",
              from: 2,
              to: 2,
              greedy: true
            }
          });
          return startIndex;
        }
        i++;
      }
      return index2;
    }
    function combineWithPreviousRepetition(alternative, child, index2) {
      var node = alternative.node;
      var i = 0;
      while (i < index2) {
        var previousChild = alternative.getChild(i);
        if (previousChild.node.type === "Repetition" && previousChild.node.quantifier.greedy) {
          var left = previousChild.getChild();
          var right = void 0;
          if (left.node.type === "Group" && !left.node.capturing) {
            left = left.getChild();
          }
          if (i + 1 === index2) {
            right = child;
            if (right.node.type === "Group" && !right.node.capturing) {
              right = right.getChild();
            }
          } else {
            right = NodePath.getForNode({
              type: "Alternative",
              expressions: [].concat(_toConsumableArray(node.expressions.slice(i + 1, index2 + 1)))
            });
          }
          if (left.hasEqualSource(right)) {
            for (var j = i; j < index2; j++) {
              alternative.getChild(i + 1).remove();
            }
            increaseQuantifierByOne(previousChild.node.quantifier);
            return i;
          }
        }
        i++;
      }
      return index2;
    }
    function combineRepetitionWithPrevious(alternative, child, index2) {
      var node = alternative.node;
      if (child.node.type === "Repetition" && child.node.quantifier.greedy) {
        var right = child.getChild();
        var left = void 0;
        if (right.node.type === "Group" && !right.node.capturing) {
          right = right.getChild();
        }
        var rightLength = void 0;
        if (right.node.type === "Alternative") {
          rightLength = right.node.expressions.length;
          left = NodePath.getForNode({
            type: "Alternative",
            expressions: [].concat(_toConsumableArray(node.expressions.slice(index2 - rightLength, index2)))
          });
        } else {
          rightLength = 1;
          left = alternative.getChild(index2 - 1);
          if (left.node.type === "Group" && !left.node.capturing) {
            left = left.getChild();
          }
        }
        if (left.hasEqualSource(right)) {
          for (var j = index2 - rightLength; j < index2; j++) {
            alternative.getChild(index2 - rightLength).remove();
          }
          increaseQuantifierByOne(child.node.quantifier);
          return index2 - rightLength;
        }
      }
      return index2;
    }
  }
});

// node_modules/regexp-tree/dist/optimizer/transforms/index.js
var require_transforms2 = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/transforms/index.js"(exports, module2) {
    "use strict";
    module2.exports = new Map([
      ["charSurrogatePairToSingleUnicode", require_char_surrogate_pair_to_single_unicode_transform()],
      ["charCodeToSimpleChar", require_char_code_to_simple_char_transform()],
      ["charCaseInsensitiveLowerCaseTransform", require_char_case_insensitive_lowercase_transform()],
      ["charClassRemoveDuplicates", require_char_class_remove_duplicates_transform()],
      ["quantifiersMerge", require_quantifiers_merge_transform()],
      ["quantifierRangeToSymbol", require_quantifier_range_to_symbol_transform()],
      ["charClassClassrangesToChars", require_char_class_classranges_to_chars_transform()],
      ["charClassToMeta", require_char_class_to_meta_transform()],
      ["charClassToSingleChar", require_char_class_to_single_char_transform()],
      ["charEscapeUnescape", require_char_escape_unescape_transform()],
      ["charClassClassrangesMerge", require_char_class_classranges_merge_transform()],
      ["disjunctionRemoveDuplicates", require_disjunction_remove_duplicates_transform()],
      ["groupSingleCharsToCharClass", require_group_single_chars_to_char_class()],
      ["removeEmptyGroup", require_remove_empty_group_transform()],
      ["ungroup", require_ungroup_transform()],
      ["combineRepeatingPatterns", require_combine_repeating_patterns_transform()]
    ]);
  }
});

// node_modules/regexp-tree/dist/optimizer/index.js
var require_optimizer = __commonJS({
  "node_modules/regexp-tree/dist/optimizer/index.js"(exports, module2) {
    "use strict";
    var clone2 = require_clone();
    var parser2 = require_parser();
    var transform = require_transform();
    var optimizationTransforms = require_transforms2();
    module2.exports = {
      optimize: function optimize(regexp) {
        var _ref = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}, _ref$whitelist = _ref.whitelist, whitelist = _ref$whitelist === void 0 ? [] : _ref$whitelist, _ref$blacklist = _ref.blacklist, blacklist = _ref$blacklist === void 0 ? [] : _ref$blacklist;
        var transformsRaw = whitelist.length > 0 ? whitelist : Array.from(optimizationTransforms.keys());
        var transformToApply = transformsRaw.filter(function(transform2) {
          return !blacklist.includes(transform2);
        });
        var ast = regexp;
        if (regexp instanceof RegExp) {
          regexp = "" + regexp;
        }
        if (typeof regexp === "string") {
          ast = parser2.parse(regexp);
        }
        var result = new transform.TransformResult(ast);
        var prevResultString = void 0;
        do {
          prevResultString = result.toString();
          ast = clone2(result.getAST());
          transformToApply.forEach(function(transformName) {
            if (!optimizationTransforms.has(transformName)) {
              throw new Error("Unknown optimization-transform: " + transformName + ". Available transforms are: " + Array.from(optimizationTransforms.keys()).join(", "));
            }
            var transformer = optimizationTransforms.get(transformName);
            var newResult = transform.transform(ast, transformer);
            if (newResult.toString() !== result.toString()) {
              if (newResult.toString().length <= result.toString().length) {
                result = newResult;
              } else {
                ast = clone2(result.getAST());
              }
            }
          });
        } while (result.toString() !== prevResultString);
        return result;
      }
    };
  }
});

// node_modules/regexp-tree/dist/interpreter/finite-automaton/special-symbols.js
var require_special_symbols = __commonJS({
  "node_modules/regexp-tree/dist/interpreter/finite-automaton/special-symbols.js"(exports, module2) {
    "use strict";
    var EPSILON = "\u03B5";
    var EPSILON_CLOSURE = EPSILON + "*";
    module2.exports = {
      EPSILON,
      EPSILON_CLOSURE
    };
  }
});

// node_modules/regexp-tree/dist/interpreter/finite-automaton/nfa/nfa.js
var require_nfa = __commonJS({
  "node_modules/regexp-tree/dist/interpreter/finite-automaton/nfa/nfa.js"(exports, module2) {
    "use strict";
    var _slicedToArray = function() {
      function sliceIterator(arr, i) {
        var _arr = [];
        var _n = true;
        var _d = false;
        var _e = void 0;
        try {
          for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
            _arr.push(_s.value);
            if (i && _arr.length === i)
              break;
          }
        } catch (err) {
          _d = true;
          _e = err;
        } finally {
          try {
            if (!_n && _i["return"])
              _i["return"]();
          } finally {
            if (_d)
              throw _e;
          }
        }
        return _arr;
      }
      return function(arr, i) {
        if (Array.isArray(arr)) {
          return arr;
        } else if (Symbol.iterator in Object(arr)) {
          return sliceIterator(arr, i);
        } else {
          throw new TypeError("Invalid attempt to destructure non-iterable instance");
        }
      };
    }();
    var _createClass = function() {
      function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
          var descriptor = props[i];
          descriptor.enumerable = descriptor.enumerable || false;
          descriptor.configurable = true;
          if ("value" in descriptor)
            descriptor.writable = true;
          Object.defineProperty(target, descriptor.key, descriptor);
        }
      }
      return function(Constructor, protoProps, staticProps) {
        if (protoProps)
          defineProperties(Constructor.prototype, protoProps);
        if (staticProps)
          defineProperties(Constructor, staticProps);
        return Constructor;
      };
    }();
    function _toConsumableArray(arr) {
      if (Array.isArray(arr)) {
        for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
          arr2[i] = arr[i];
        }
        return arr2;
      } else {
        return Array.from(arr);
      }
    }
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    var _require = require_special_symbols();
    var EPSILON = _require.EPSILON;
    var EPSILON_CLOSURE = _require.EPSILON_CLOSURE;
    var NFA = function() {
      function NFA2(inState, outState) {
        _classCallCheck(this, NFA2);
        this.in = inState;
        this.out = outState;
      }
      _createClass(NFA2, [{
        key: "matches",
        value: function matches2(string) {
          return this.in.matches(string);
        }
      }, {
        key: "getAlphabet",
        value: function getAlphabet() {
          if (!this._alphabet) {
            this._alphabet = new Set();
            var table = this.getTransitionTable();
            for (var state in table) {
              var transitions = table[state];
              for (var symbol in transitions) {
                if (symbol !== EPSILON_CLOSURE) {
                  this._alphabet.add(symbol);
                }
              }
            }
          }
          return this._alphabet;
        }
      }, {
        key: "getAcceptingStates",
        value: function getAcceptingStates() {
          if (!this._acceptingStates) {
            this.getTransitionTable();
          }
          return this._acceptingStates;
        }
      }, {
        key: "getAcceptingStateNumbers",
        value: function getAcceptingStateNumbers() {
          if (!this._acceptingStateNumbers) {
            this._acceptingStateNumbers = new Set();
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = void 0;
            try {
              for (var _iterator = this.getAcceptingStates()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var acceptingState = _step.value;
                this._acceptingStateNumbers.add(acceptingState.number);
              }
            } catch (err) {
              _didIteratorError = true;
              _iteratorError = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }
              } finally {
                if (_didIteratorError) {
                  throw _iteratorError;
                }
              }
            }
          }
          return this._acceptingStateNumbers;
        }
      }, {
        key: "getTransitionTable",
        value: function getTransitionTable() {
          var _this = this;
          if (!this._transitionTable) {
            this._transitionTable = {};
            this._acceptingStates = new Set();
            var visited = new Set();
            var symbols = new Set();
            var visitState = function visitState2(state) {
              if (visited.has(state)) {
                return;
              }
              visited.add(state);
              state.number = visited.size;
              _this._transitionTable[state.number] = {};
              if (state.accepting) {
                _this._acceptingStates.add(state);
              }
              var transitions = state.getTransitions();
              var _iteratorNormalCompletion2 = true;
              var _didIteratorError2 = false;
              var _iteratorError2 = void 0;
              try {
                for (var _iterator2 = transitions[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                  var _ref = _step2.value;
                  var _ref2 = _slicedToArray(_ref, 2);
                  var symbol = _ref2[0];
                  var symbolTransitions = _ref2[1];
                  var combinedState = [];
                  symbols.add(symbol);
                  var _iteratorNormalCompletion3 = true;
                  var _didIteratorError3 = false;
                  var _iteratorError3 = void 0;
                  try {
                    for (var _iterator3 = symbolTransitions[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                      var nextState = _step3.value;
                      visitState2(nextState);
                      combinedState.push(nextState.number);
                    }
                  } catch (err) {
                    _didIteratorError3 = true;
                    _iteratorError3 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion3 && _iterator3.return) {
                        _iterator3.return();
                      }
                    } finally {
                      if (_didIteratorError3) {
                        throw _iteratorError3;
                      }
                    }
                  }
                  _this._transitionTable[state.number][symbol] = combinedState;
                }
              } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion2 && _iterator2.return) {
                    _iterator2.return();
                  }
                } finally {
                  if (_didIteratorError2) {
                    throw _iteratorError2;
                  }
                }
              }
            };
            visitState(this.in);
            visited.forEach(function(state) {
              delete _this._transitionTable[state.number][EPSILON];
              _this._transitionTable[state.number][EPSILON_CLOSURE] = [].concat(_toConsumableArray(state.getEpsilonClosure())).map(function(s) {
                return s.number;
              });
            });
          }
          return this._transitionTable;
        }
      }]);
      return NFA2;
    }();
    module2.exports = NFA;
  }
});

// node_modules/regexp-tree/dist/interpreter/finite-automaton/dfa/dfa-minimizer.js
var require_dfa_minimizer = __commonJS({
  "node_modules/regexp-tree/dist/interpreter/finite-automaton/dfa/dfa-minimizer.js"(exports, module2) {
    "use strict";
    var _slicedToArray = function() {
      function sliceIterator(arr, i) {
        var _arr = [];
        var _n = true;
        var _d = false;
        var _e = void 0;
        try {
          for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
            _arr.push(_s.value);
            if (i && _arr.length === i)
              break;
          }
        } catch (err) {
          _d = true;
          _e = err;
        } finally {
          try {
            if (!_n && _i["return"])
              _i["return"]();
          } finally {
            if (_d)
              throw _e;
          }
        }
        return _arr;
      }
      return function(arr, i) {
        if (Array.isArray(arr)) {
          return arr;
        } else if (Symbol.iterator in Object(arr)) {
          return sliceIterator(arr, i);
        } else {
          throw new TypeError("Invalid attempt to destructure non-iterable instance");
        }
      };
    }();
    function _toArray(arr) {
      return Array.isArray(arr) ? arr : Array.from(arr);
    }
    function _toConsumableArray(arr) {
      if (Array.isArray(arr)) {
        for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
          arr2[i] = arr[i];
        }
        return arr2;
      } else {
        return Array.from(arr);
      }
    }
    var currentTransitionMap = null;
    function minimize(dfa) {
      var table = dfa.getTransitionTable();
      var allStates = Object.keys(table);
      var alphabet = dfa.getAlphabet();
      var accepting = dfa.getAcceptingStateNumbers();
      currentTransitionMap = {};
      var nonAccepting = new Set();
      allStates.forEach(function(state) {
        state = Number(state);
        var isAccepting = accepting.has(state);
        if (isAccepting) {
          currentTransitionMap[state] = accepting;
        } else {
          nonAccepting.add(state);
          currentTransitionMap[state] = nonAccepting;
        }
      });
      var all = [
        [nonAccepting, accepting].filter(function(set2) {
          return set2.size > 0;
        })
      ];
      var current = void 0;
      var previous = void 0;
      current = all[all.length - 1];
      previous = all[all.length - 2];
      var _loop = function _loop2() {
        var newTransitionMap = {};
        var _iteratorNormalCompletion3 = true;
        var _didIteratorError3 = false;
        var _iteratorError3 = void 0;
        try {
          for (var _iterator3 = current[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var _set = _step3.value;
            var handledStates = {};
            var _set2 = _toArray(_set), first = _set2[0], rest = _set2.slice(1);
            handledStates[first] = new Set([first]);
            var _iteratorNormalCompletion4 = true;
            var _didIteratorError4 = false;
            var _iteratorError4 = void 0;
            try {
              restSets:
                for (var _iterator4 = rest[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                  var state = _step4.value;
                  var _iteratorNormalCompletion5 = true;
                  var _didIteratorError5 = false;
                  var _iteratorError5 = void 0;
                  try {
                    for (var _iterator5 = Object.keys(handledStates)[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
                      var handledState = _step5.value;
                      if (areEquivalent(state, handledState, table, alphabet)) {
                        handledStates[handledState].add(state);
                        handledStates[state] = handledStates[handledState];
                        continue restSets;
                      }
                    }
                  } catch (err) {
                    _didIteratorError5 = true;
                    _iteratorError5 = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion5 && _iterator5.return) {
                        _iterator5.return();
                      }
                    } finally {
                      if (_didIteratorError5) {
                        throw _iteratorError5;
                      }
                    }
                  }
                  handledStates[state] = new Set([state]);
                }
            } catch (err) {
              _didIteratorError4 = true;
              _iteratorError4 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion4 && _iterator4.return) {
                  _iterator4.return();
                }
              } finally {
                if (_didIteratorError4) {
                  throw _iteratorError4;
                }
              }
            }
            Object.assign(newTransitionMap, handledStates);
          }
        } catch (err) {
          _didIteratorError3 = true;
          _iteratorError3 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
              _iterator3.return();
            }
          } finally {
            if (_didIteratorError3) {
              throw _iteratorError3;
            }
          }
        }
        currentTransitionMap = newTransitionMap;
        var newSets = new Set(Object.keys(newTransitionMap).map(function(state2) {
          return newTransitionMap[state2];
        }));
        all.push([].concat(_toConsumableArray(newSets)));
        current = all[all.length - 1];
        previous = all[all.length - 2];
      };
      while (!sameRow(current, previous)) {
        _loop();
      }
      var remaped = new Map();
      var idx = 1;
      current.forEach(function(set2) {
        return remaped.set(set2, idx++);
      });
      var minimizedTable = {};
      var minimizedAcceptingStates = new Set();
      var updateAcceptingStates = function updateAcceptingStates2(set2, idx2) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = void 0;
        try {
          for (var _iterator = set2[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var state = _step.value;
            if (accepting.has(state)) {
              minimizedAcceptingStates.add(idx2);
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      };
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = void 0;
      try {
        for (var _iterator2 = remaped.entries()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var _ref = _step2.value;
          var _ref2 = _slicedToArray(_ref, 2);
          var set = _ref2[0];
          var _idx = _ref2[1];
          minimizedTable[_idx] = {};
          var _iteratorNormalCompletion6 = true;
          var _didIteratorError6 = false;
          var _iteratorError6 = void 0;
          try {
            for (var _iterator6 = alphabet[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
              var symbol = _step6.value;
              updateAcceptingStates(set, _idx);
              var originalTransition = void 0;
              var _iteratorNormalCompletion7 = true;
              var _didIteratorError7 = false;
              var _iteratorError7 = void 0;
              try {
                for (var _iterator7 = set[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
                  var originalState = _step7.value;
                  originalTransition = table[originalState][symbol];
                  if (originalTransition) {
                    break;
                  }
                }
              } catch (err) {
                _didIteratorError7 = true;
                _iteratorError7 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion7 && _iterator7.return) {
                    _iterator7.return();
                  }
                } finally {
                  if (_didIteratorError7) {
                    throw _iteratorError7;
                  }
                }
              }
              if (originalTransition) {
                minimizedTable[_idx][symbol] = remaped.get(currentTransitionMap[originalTransition]);
              }
            }
          } catch (err) {
            _didIteratorError6 = true;
            _iteratorError6 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion6 && _iterator6.return) {
                _iterator6.return();
              }
            } finally {
              if (_didIteratorError6) {
                throw _iteratorError6;
              }
            }
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
      dfa.setTransitionTable(minimizedTable);
      dfa.setAcceptingStateNumbers(minimizedAcceptingStates);
      return dfa;
    }
    function sameRow(r1, r2) {
      if (!r2) {
        return false;
      }
      if (r1.length !== r2.length) {
        return false;
      }
      for (var i = 0; i < r1.length; i++) {
        var s1 = r1[i];
        var s2 = r2[i];
        if (s1.size !== s2.size) {
          return false;
        }
        if ([].concat(_toConsumableArray(s1)).sort().join(",") !== [].concat(_toConsumableArray(s2)).sort().join(",")) {
          return false;
        }
      }
      return true;
    }
    function areEquivalent(s1, s2, table, alphabet) {
      var _iteratorNormalCompletion8 = true;
      var _didIteratorError8 = false;
      var _iteratorError8 = void 0;
      try {
        for (var _iterator8 = alphabet[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
          var symbol = _step8.value;
          if (!goToSameSet(s1, s2, table, symbol)) {
            return false;
          }
        }
      } catch (err) {
        _didIteratorError8 = true;
        _iteratorError8 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion8 && _iterator8.return) {
            _iterator8.return();
          }
        } finally {
          if (_didIteratorError8) {
            throw _iteratorError8;
          }
        }
      }
      return true;
    }
    function goToSameSet(s1, s2, table, symbol) {
      if (!currentTransitionMap[s1] || !currentTransitionMap[s2]) {
        return false;
      }
      var originalTransitionS1 = table[s1][symbol];
      var originalTransitionS2 = table[s2][symbol];
      if (!originalTransitionS1 && !originalTransitionS2) {
        return true;
      }
      return currentTransitionMap[s1].has(originalTransitionS1) && currentTransitionMap[s2].has(originalTransitionS2);
    }
    module2.exports = {
      minimize
    };
  }
});

// node_modules/regexp-tree/dist/interpreter/finite-automaton/dfa/dfa.js
var require_dfa = __commonJS({
  "node_modules/regexp-tree/dist/interpreter/finite-automaton/dfa/dfa.js"(exports, module2) {
    "use strict";
    var _createClass = function() {
      function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
          var descriptor = props[i];
          descriptor.enumerable = descriptor.enumerable || false;
          descriptor.configurable = true;
          if ("value" in descriptor)
            descriptor.writable = true;
          Object.defineProperty(target, descriptor.key, descriptor);
        }
      }
      return function(Constructor, protoProps, staticProps) {
        if (protoProps)
          defineProperties(Constructor.prototype, protoProps);
        if (staticProps)
          defineProperties(Constructor, staticProps);
        return Constructor;
      };
    }();
    function _toConsumableArray(arr) {
      if (Array.isArray(arr)) {
        for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
          arr2[i] = arr[i];
        }
        return arr2;
      } else {
        return Array.from(arr);
      }
    }
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    var DFAMinimizer = require_dfa_minimizer();
    var _require = require_special_symbols();
    var EPSILON_CLOSURE = _require.EPSILON_CLOSURE;
    var DFA = function() {
      function DFA2(nfa) {
        _classCallCheck(this, DFA2);
        this._nfa = nfa;
      }
      _createClass(DFA2, [{
        key: "minimize",
        value: function minimize() {
          this.getTransitionTable();
          this._originalAcceptingStateNumbers = this._acceptingStateNumbers;
          this._originalTransitionTable = this._transitionTable;
          DFAMinimizer.minimize(this);
        }
      }, {
        key: "getAlphabet",
        value: function getAlphabet() {
          return this._nfa.getAlphabet();
        }
      }, {
        key: "getAcceptingStateNumbers",
        value: function getAcceptingStateNumbers() {
          if (!this._acceptingStateNumbers) {
            this.getTransitionTable();
          }
          return this._acceptingStateNumbers;
        }
      }, {
        key: "getOriginaAcceptingStateNumbers",
        value: function getOriginaAcceptingStateNumbers() {
          if (!this._originalAcceptingStateNumbers) {
            this.getTransitionTable();
          }
          return this._originalAcceptingStateNumbers;
        }
      }, {
        key: "setTransitionTable",
        value: function setTransitionTable(table) {
          this._transitionTable = table;
        }
      }, {
        key: "setAcceptingStateNumbers",
        value: function setAcceptingStateNumbers(stateNumbers) {
          this._acceptingStateNumbers = stateNumbers;
        }
      }, {
        key: "getTransitionTable",
        value: function getTransitionTable() {
          var _this = this;
          if (this._transitionTable) {
            return this._transitionTable;
          }
          var nfaTable = this._nfa.getTransitionTable();
          var nfaStates = Object.keys(nfaTable);
          this._acceptingStateNumbers = new Set();
          var startState = nfaTable[nfaStates[0]][EPSILON_CLOSURE];
          var worklist = [startState];
          var alphabet = this.getAlphabet();
          var nfaAcceptingStates = this._nfa.getAcceptingStateNumbers();
          var dfaTable = {};
          var updateAcceptingStates = function updateAcceptingStates2(states2) {
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = void 0;
            try {
              for (var _iterator = nfaAcceptingStates[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var nfaAcceptingState = _step.value;
                if (states2.indexOf(nfaAcceptingState) !== -1) {
                  _this._acceptingStateNumbers.add(states2.join(","));
                  break;
                }
              }
            } catch (err) {
              _didIteratorError = true;
              _iteratorError = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }
              } finally {
                if (_didIteratorError) {
                  throw _iteratorError;
                }
              }
            }
          };
          while (worklist.length > 0) {
            var states = worklist.shift();
            var dfaStateLabel = states.join(",");
            dfaTable[dfaStateLabel] = {};
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = void 0;
            try {
              for (var _iterator2 = alphabet[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var symbol = _step2.value;
                var onSymbol = [];
                updateAcceptingStates(states);
                var _iteratorNormalCompletion3 = true;
                var _didIteratorError3 = false;
                var _iteratorError3 = void 0;
                try {
                  for (var _iterator3 = states[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                    var state = _step3.value;
                    var nfaStatesOnSymbol = nfaTable[state][symbol];
                    if (!nfaStatesOnSymbol) {
                      continue;
                    }
                    var _iteratorNormalCompletion4 = true;
                    var _didIteratorError4 = false;
                    var _iteratorError4 = void 0;
                    try {
                      for (var _iterator4 = nfaStatesOnSymbol[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                        var nfaStateOnSymbol = _step4.value;
                        if (!nfaTable[nfaStateOnSymbol]) {
                          continue;
                        }
                        onSymbol.push.apply(onSymbol, _toConsumableArray(nfaTable[nfaStateOnSymbol][EPSILON_CLOSURE]));
                      }
                    } catch (err) {
                      _didIteratorError4 = true;
                      _iteratorError4 = err;
                    } finally {
                      try {
                        if (!_iteratorNormalCompletion4 && _iterator4.return) {
                          _iterator4.return();
                        }
                      } finally {
                        if (_didIteratorError4) {
                          throw _iteratorError4;
                        }
                      }
                    }
                  }
                } catch (err) {
                  _didIteratorError3 = true;
                  _iteratorError3 = err;
                } finally {
                  try {
                    if (!_iteratorNormalCompletion3 && _iterator3.return) {
                      _iterator3.return();
                    }
                  } finally {
                    if (_didIteratorError3) {
                      throw _iteratorError3;
                    }
                  }
                }
                var dfaStatesOnSymbolSet = new Set(onSymbol);
                var dfaStatesOnSymbol = [].concat(_toConsumableArray(dfaStatesOnSymbolSet));
                if (dfaStatesOnSymbol.length > 0) {
                  var dfaOnSymbolStr = dfaStatesOnSymbol.join(",");
                  dfaTable[dfaStateLabel][symbol] = dfaOnSymbolStr;
                  if (!dfaTable.hasOwnProperty(dfaOnSymbolStr)) {
                    worklist.unshift(dfaStatesOnSymbol);
                  }
                }
              }
            } catch (err) {
              _didIteratorError2 = true;
              _iteratorError2 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                  _iterator2.return();
                }
              } finally {
                if (_didIteratorError2) {
                  throw _iteratorError2;
                }
              }
            }
          }
          return this._transitionTable = this._remapStateNumbers(dfaTable);
        }
      }, {
        key: "_remapStateNumbers",
        value: function _remapStateNumbers(calculatedDFATable) {
          var newStatesMap = {};
          this._originalTransitionTable = calculatedDFATable;
          var transitionTable = {};
          Object.keys(calculatedDFATable).forEach(function(originalNumber2, newNumber) {
            newStatesMap[originalNumber2] = newNumber + 1;
          });
          for (var originalNumber in calculatedDFATable) {
            var originalRow = calculatedDFATable[originalNumber];
            var row = {};
            for (var symbol in originalRow) {
              row[symbol] = newStatesMap[originalRow[symbol]];
            }
            transitionTable[newStatesMap[originalNumber]] = row;
          }
          this._originalAcceptingStateNumbers = this._acceptingStateNumbers;
          this._acceptingStateNumbers = new Set();
          var _iteratorNormalCompletion5 = true;
          var _didIteratorError5 = false;
          var _iteratorError5 = void 0;
          try {
            for (var _iterator5 = this._originalAcceptingStateNumbers[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
              var _originalNumber = _step5.value;
              this._acceptingStateNumbers.add(newStatesMap[_originalNumber]);
            }
          } catch (err) {
            _didIteratorError5 = true;
            _iteratorError5 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion5 && _iterator5.return) {
                _iterator5.return();
              }
            } finally {
              if (_didIteratorError5) {
                throw _iteratorError5;
              }
            }
          }
          return transitionTable;
        }
      }, {
        key: "getOriginalTransitionTable",
        value: function getOriginalTransitionTable() {
          if (!this._originalTransitionTable) {
            this.getTransitionTable();
          }
          return this._originalTransitionTable;
        }
      }, {
        key: "matches",
        value: function matches2(string) {
          var state = 1;
          var i = 0;
          var table = this.getTransitionTable();
          while (string[i]) {
            state = table[state][string[i++]];
            if (!state) {
              return false;
            }
          }
          if (!this.getAcceptingStateNumbers().has(state)) {
            return false;
          }
          return true;
        }
      }]);
      return DFA2;
    }();
    module2.exports = DFA;
  }
});

// node_modules/regexp-tree/dist/interpreter/finite-automaton/state.js
var require_state = __commonJS({
  "node_modules/regexp-tree/dist/interpreter/finite-automaton/state.js"(exports, module2) {
    "use strict";
    var _createClass = function() {
      function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
          var descriptor = props[i];
          descriptor.enumerable = descriptor.enumerable || false;
          descriptor.configurable = true;
          if ("value" in descriptor)
            descriptor.writable = true;
          Object.defineProperty(target, descriptor.key, descriptor);
        }
      }
      return function(Constructor, protoProps, staticProps) {
        if (protoProps)
          defineProperties(Constructor.prototype, protoProps);
        if (staticProps)
          defineProperties(Constructor, staticProps);
        return Constructor;
      };
    }();
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    var State = function() {
      function State2() {
        var _ref = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {}, _ref$accepting = _ref.accepting, accepting = _ref$accepting === void 0 ? false : _ref$accepting;
        _classCallCheck(this, State2);
        this._transitions = new Map();
        this.accepting = accepting;
      }
      _createClass(State2, [{
        key: "getTransitions",
        value: function getTransitions() {
          return this._transitions;
        }
      }, {
        key: "addTransition",
        value: function addTransition(symbol, toState) {
          this.getTransitionsOnSymbol(symbol).add(toState);
          return this;
        }
      }, {
        key: "getTransitionsOnSymbol",
        value: function getTransitionsOnSymbol(symbol) {
          var transitions = this._transitions.get(symbol);
          if (!transitions) {
            transitions = new Set();
            this._transitions.set(symbol, transitions);
          }
          return transitions;
        }
      }]);
      return State2;
    }();
    module2.exports = State;
  }
});

// node_modules/regexp-tree/dist/interpreter/finite-automaton/nfa/nfa-state.js
var require_nfa_state = __commonJS({
  "node_modules/regexp-tree/dist/interpreter/finite-automaton/nfa/nfa-state.js"(exports, module2) {
    "use strict";
    var _createClass = function() {
      function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
          var descriptor = props[i];
          descriptor.enumerable = descriptor.enumerable || false;
          descriptor.configurable = true;
          if ("value" in descriptor)
            descriptor.writable = true;
          Object.defineProperty(target, descriptor.key, descriptor);
        }
      }
      return function(Constructor, protoProps, staticProps) {
        if (protoProps)
          defineProperties(Constructor.prototype, protoProps);
        if (staticProps)
          defineProperties(Constructor, staticProps);
        return Constructor;
      };
    }();
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    function _possibleConstructorReturn(self2, call) {
      if (!self2) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
      }
      return call && (typeof call === "object" || typeof call === "function") ? call : self2;
    }
    function _inherits(subClass, superClass) {
      if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
      }
      subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });
      if (superClass)
        Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
    }
    var State = require_state();
    var _require = require_special_symbols();
    var EPSILON = _require.EPSILON;
    var NFAState = function(_State) {
      _inherits(NFAState2, _State);
      function NFAState2() {
        _classCallCheck(this, NFAState2);
        return _possibleConstructorReturn(this, (NFAState2.__proto__ || Object.getPrototypeOf(NFAState2)).apply(this, arguments));
      }
      _createClass(NFAState2, [{
        key: "matches",
        value: function matches2(string) {
          var visited = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : new Set();
          if (visited.has(this)) {
            return false;
          }
          visited.add(this);
          if (string.length === 0) {
            if (this.accepting) {
              return true;
            }
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = void 0;
            try {
              for (var _iterator = this.getTransitionsOnSymbol(EPSILON)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var nextState = _step.value;
                if (nextState.matches("", visited)) {
                  return true;
                }
              }
            } catch (err) {
              _didIteratorError = true;
              _iteratorError = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }
              } finally {
                if (_didIteratorError) {
                  throw _iteratorError;
                }
              }
            }
            return false;
          }
          var symbol = string[0];
          var rest = string.slice(1);
          var symbolTransitions = this.getTransitionsOnSymbol(symbol);
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = void 0;
          try {
            for (var _iterator2 = symbolTransitions[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              var _nextState = _step2.value;
              if (_nextState.matches(rest)) {
                return true;
              }
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
              }
            } finally {
              if (_didIteratorError2) {
                throw _iteratorError2;
              }
            }
          }
          var _iteratorNormalCompletion3 = true;
          var _didIteratorError3 = false;
          var _iteratorError3 = void 0;
          try {
            for (var _iterator3 = this.getTransitionsOnSymbol(EPSILON)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
              var _nextState2 = _step3.value;
              if (_nextState2.matches(string, visited)) {
                return true;
              }
            }
          } catch (err) {
            _didIteratorError3 = true;
            _iteratorError3 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion3 && _iterator3.return) {
                _iterator3.return();
              }
            } finally {
              if (_didIteratorError3) {
                throw _iteratorError3;
              }
            }
          }
          return false;
        }
      }, {
        key: "getEpsilonClosure",
        value: function getEpsilonClosure() {
          var _this2 = this;
          if (!this._epsilonClosure) {
            (function() {
              var epsilonTransitions = _this2.getTransitionsOnSymbol(EPSILON);
              var closure = _this2._epsilonClosure = new Set();
              closure.add(_this2);
              var _iteratorNormalCompletion4 = true;
              var _didIteratorError4 = false;
              var _iteratorError4 = void 0;
              try {
                for (var _iterator4 = epsilonTransitions[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                  var nextState = _step4.value;
                  if (!closure.has(nextState)) {
                    closure.add(nextState);
                    var nextClosure = nextState.getEpsilonClosure();
                    nextClosure.forEach(function(state) {
                      return closure.add(state);
                    });
                  }
                }
              } catch (err) {
                _didIteratorError4 = true;
                _iteratorError4 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion4 && _iterator4.return) {
                    _iterator4.return();
                  }
                } finally {
                  if (_didIteratorError4) {
                    throw _iteratorError4;
                  }
                }
              }
            })();
          }
          return this._epsilonClosure;
        }
      }]);
      return NFAState2;
    }(State);
    module2.exports = NFAState;
  }
});

// node_modules/regexp-tree/dist/interpreter/finite-automaton/nfa/builders.js
var require_builders = __commonJS({
  "node_modules/regexp-tree/dist/interpreter/finite-automaton/nfa/builders.js"(exports, module2) {
    "use strict";
    var NFA = require_nfa();
    var NFAState = require_nfa_state();
    var _require = require_special_symbols();
    var EPSILON = _require.EPSILON;
    function char(c) {
      var inState = new NFAState();
      var outState = new NFAState({
        accepting: true
      });
      return new NFA(inState.addTransition(c, outState), outState);
    }
    function e() {
      return char(EPSILON);
    }
    function altPair(first, second) {
      first.out.accepting = false;
      second.out.accepting = true;
      first.out.addTransition(EPSILON, second.in);
      return new NFA(first.in, second.out);
    }
    function alt(first) {
      for (var _len = arguments.length, fragments = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        fragments[_key - 1] = arguments[_key];
      }
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = void 0;
      try {
        for (var _iterator = fragments[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var fragment = _step.value;
          first = altPair(first, fragment);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }
      return first;
    }
    function orPair(first, second) {
      var inState = new NFAState();
      var outState = new NFAState();
      inState.addTransition(EPSILON, first.in);
      inState.addTransition(EPSILON, second.in);
      outState.accepting = true;
      first.out.accepting = false;
      second.out.accepting = false;
      first.out.addTransition(EPSILON, outState);
      second.out.addTransition(EPSILON, outState);
      return new NFA(inState, outState);
    }
    function or(first) {
      for (var _len2 = arguments.length, fragments = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        fragments[_key2 - 1] = arguments[_key2];
      }
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = void 0;
      try {
        for (var _iterator2 = fragments[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var fragment = _step2.value;
          first = orPair(first, fragment);
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
      return first;
    }
    function repExplicit(fragment) {
      var inState = new NFAState();
      var outState = new NFAState({
        accepting: true
      });
      inState.addTransition(EPSILON, fragment.in);
      inState.addTransition(EPSILON, outState);
      fragment.out.accepting = false;
      fragment.out.addTransition(EPSILON, outState);
      outState.addTransition(EPSILON, fragment.in);
      return new NFA(inState, outState);
    }
    function rep(fragment) {
      fragment.in.addTransition(EPSILON, fragment.out);
      fragment.out.addTransition(EPSILON, fragment.in);
      return fragment;
    }
    function plusRep(fragment) {
      fragment.out.addTransition(EPSILON, fragment.in);
      return fragment;
    }
    function questionRep(fragment) {
      fragment.in.addTransition(EPSILON, fragment.out);
      return fragment;
    }
    module2.exports = {
      alt,
      char,
      e,
      or,
      rep,
      repExplicit,
      plusRep,
      questionRep
    };
  }
});

// node_modules/regexp-tree/dist/interpreter/finite-automaton/nfa/nfa-from-regexp.js
var require_nfa_from_regexp = __commonJS({
  "node_modules/regexp-tree/dist/interpreter/finite-automaton/nfa/nfa-from-regexp.js"(exports, module2) {
    "use strict";
    function _toConsumableArray(arr) {
      if (Array.isArray(arr)) {
        for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) {
          arr2[i] = arr[i];
        }
        return arr2;
      } else {
        return Array.from(arr);
      }
    }
    var parser2 = require_parser();
    var _require = require_builders();
    var alt = _require.alt;
    var char = _require.char;
    var or = _require.or;
    var rep = _require.rep;
    var plusRep = _require.plusRep;
    var questionRep = _require.questionRep;
    function gen(node) {
      if (node && !generator[node.type]) {
        throw new Error(node.type + " is not supported in NFA/DFA interpreter.");
      }
      return node ? generator[node.type](node) : "";
    }
    var generator = {
      RegExp: function RegExp2(node) {
        if (node.flags !== "") {
          throw new Error("NFA/DFA: Flags are not supported yet.");
        }
        return gen(node.body);
      },
      Alternative: function Alternative(node) {
        var fragments = (node.expressions || []).map(gen);
        return alt.apply(void 0, _toConsumableArray(fragments));
      },
      Disjunction: function Disjunction(node) {
        return or(gen(node.left), gen(node.right));
      },
      Repetition: function Repetition(node) {
        switch (node.quantifier.kind) {
          case "*":
            return rep(gen(node.expression));
          case "+":
            return plusRep(gen(node.expression));
          case "?":
            return questionRep(gen(node.expression));
          default:
            throw new Error("Unknown repeatition: " + node.quantifier.kind + ".");
        }
      },
      Char: function Char(node) {
        if (node.kind !== "simple") {
          throw new Error("NFA/DFA: Only simple chars are supported yet.");
        }
        return char(node.value);
      },
      Group: function Group(node) {
        return gen(node.expression);
      }
    };
    module2.exports = {
      build: function build(regexp) {
        var ast = regexp;
        if (regexp instanceof RegExp) {
          regexp = "" + regexp;
        }
        if (typeof regexp === "string") {
          ast = parser2.parse(regexp, {
            captureLocations: true
          });
        }
        return gen(ast);
      }
    };
  }
});

// node_modules/regexp-tree/dist/interpreter/finite-automaton/index.js
var require_finite_automaton = __commonJS({
  "node_modules/regexp-tree/dist/interpreter/finite-automaton/index.js"(exports, module2) {
    "use strict";
    var NFA = require_nfa();
    var DFA = require_dfa();
    var nfaFromRegExp = require_nfa_from_regexp();
    var builders = require_builders();
    module2.exports = {
      NFA,
      DFA,
      builders,
      toNFA: function toNFA(regexp) {
        return nfaFromRegExp.build(regexp);
      },
      toDFA: function toDFA(regexp) {
        return new DFA(this.toNFA(regexp));
      },
      test: function test(regexp, string) {
        return this.toDFA(regexp).matches(string);
      }
    };
  }
});

// node_modules/regexp-tree/dist/compat-transpiler/runtime/index.js
var require_runtime = __commonJS({
  "node_modules/regexp-tree/dist/compat-transpiler/runtime/index.js"(exports, module2) {
    "use strict";
    var _createClass = function() {
      function defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
          var descriptor = props[i];
          descriptor.enumerable = descriptor.enumerable || false;
          descriptor.configurable = true;
          if ("value" in descriptor)
            descriptor.writable = true;
          Object.defineProperty(target, descriptor.key, descriptor);
        }
      }
      return function(Constructor, protoProps, staticProps) {
        if (protoProps)
          defineProperties(Constructor.prototype, protoProps);
        if (staticProps)
          defineProperties(Constructor, staticProps);
        return Constructor;
      };
    }();
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    var RegExpTree = function() {
      function RegExpTree2(re, _ref) {
        var flags = _ref.flags, groups = _ref.groups, source = _ref.source;
        _classCallCheck(this, RegExpTree2);
        this._re = re;
        this._groups = groups;
        this.flags = flags;
        this.source = source || re.source;
        this.dotAll = flags.includes("s");
        this.global = re.global;
        this.ignoreCase = re.ignoreCase;
        this.multiline = re.multiline;
        this.sticky = re.sticky;
        this.unicode = re.unicode;
      }
      _createClass(RegExpTree2, [{
        key: "test",
        value: function test(string) {
          return this._re.test(string);
        }
      }, {
        key: "compile",
        value: function compile(string) {
          return this._re.compile(string);
        }
      }, {
        key: "toString",
        value: function toString() {
          if (!this._toStringResult) {
            this._toStringResult = "/" + this.source + "/" + this.flags;
          }
          return this._toStringResult;
        }
      }, {
        key: "exec",
        value: function exec(string) {
          var result = this._re.exec(string);
          if (!this._groups || !result) {
            return result;
          }
          result.groups = {};
          for (var group in this._groups) {
            var groupNumber = this._groups[group];
            result.groups[group] = result[groupNumber];
          }
          return result;
        }
      }]);
      return RegExpTree2;
    }();
    module2.exports = {
      RegExpTree
    };
  }
});

// node_modules/regexp-tree/dist/regexp-tree.js
var require_regexp_tree2 = __commonJS({
  "node_modules/regexp-tree/dist/regexp-tree.js"(exports, module2) {
    "use strict";
    var compatTranspiler = require_compat_transpiler();
    var generator = require_generator();
    var optimizer = require_optimizer();
    var parser2 = require_parser();
    var _transform = require_transform();
    var _traverse = require_traverse();
    var fa = require_finite_automaton();
    var _require = require_runtime();
    var RegExpTree = _require.RegExpTree;
    var regexpTree = {
      parser: parser2,
      fa,
      TransformResult: _transform.TransformResult,
      parse: function parse(regexp, options) {
        return parser2.parse("" + regexp, options);
      },
      traverse: function traverse(ast, handlers, options) {
        return _traverse.traverse(ast, handlers, options);
      },
      transform: function transform(regexp, handlers) {
        return _transform.transform(regexp, handlers);
      },
      generate: function generate(ast) {
        return generator.generate(ast);
      },
      toRegExp: function toRegExp(regexp) {
        var compat = this.compatTranspile(regexp);
        return new RegExp(compat.getSource(), compat.getFlags());
      },
      optimize: function optimize(regexp, whitelist) {
        var _ref = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, blacklist = _ref.blacklist;
        return optimizer.optimize(regexp, { whitelist, blacklist });
      },
      compatTranspile: function compatTranspile(regexp, whitelist) {
        return compatTranspiler.transform(regexp, whitelist);
      },
      exec: function exec(re, string) {
        if (typeof re === "string") {
          var compat = this.compatTranspile(re);
          var extra = compat.getExtra();
          if (extra.namedCapturingGroups) {
            re = new RegExpTree(compat.toRegExp(), {
              flags: compat.getFlags(),
              source: compat.getSource(),
              groups: extra.namedCapturingGroups
            });
          } else {
            re = compat.toRegExp();
          }
        }
        return re.exec(string);
      }
    };
    module2.exports = regexpTree;
  }
});

// node_modules/regexp-tree/index.js
var require_regexp_tree3 = __commonJS({
  "node_modules/regexp-tree/index.js"(exports, module2) {
    "use strict";
    module2.exports = require_regexp_tree2();
  }
});

// node_modules/regexp-match-indices/implementation.js
var require_implementation = __commonJS({
  "node_modules/regexp-match-indices/implementation.js"(exports, module2) {
    "use strict";
    var config = require_config();
    var nativeExec = require_native();
    var regexp_tree_1 = require_regexp_tree3();
    var weakMeasurementRegExp = new WeakMap();
    function exec(string) {
      return config.mode === "spec-compliant" ? execSpecCompliant(this, string) : execLazy(this, string);
    }
    function execLazy(regexp, string) {
      const index2 = regexp.lastIndex;
      const result = nativeExec.call(regexp, string);
      if (result === null)
        return null;
      let indicesArray;
      Object.defineProperty(result, "indices", {
        enumerable: true,
        configurable: true,
        get() {
          if (indicesArray === void 0) {
            const { measurementRegExp, groupInfos } = getMeasurementRegExp(regexp);
            measurementRegExp.lastIndex = index2;
            const measuredResult = nativeExec.call(measurementRegExp, string);
            if (measuredResult === null)
              throw new TypeError();
            makeDataProperty(result, "indices", indicesArray = makeIndicesArray(measuredResult, groupInfos));
          }
          return indicesArray;
        },
        set(value) {
          makeDataProperty(result, "indices", value);
        }
      });
      return result;
    }
    function execSpecCompliant(regexp, string) {
      const { measurementRegExp, groupInfos } = getMeasurementRegExp(regexp);
      measurementRegExp.lastIndex = regexp.lastIndex;
      const measuredResult = nativeExec.call(measurementRegExp, string);
      if (measuredResult === null)
        return null;
      regexp.lastIndex = measurementRegExp.lastIndex;
      const result = [];
      makeDataProperty(result, 0, measuredResult[0]);
      for (const groupInfo of groupInfos) {
        makeDataProperty(result, groupInfo.oldGroupNumber, measuredResult[groupInfo.newGroupNumber]);
      }
      makeDataProperty(result, "index", measuredResult.index);
      makeDataProperty(result, "input", measuredResult.input);
      makeDataProperty(result, "groups", measuredResult.groups);
      makeDataProperty(result, "indices", makeIndicesArray(measuredResult, groupInfos));
      return result;
    }
    function getMeasurementRegExp(regexp) {
      let transformed = weakMeasurementRegExp.get(regexp);
      if (!transformed) {
        transformed = transformMeasurementGroups(regexp_tree_1.parse(`/${regexp.source}/${regexp.flags}`));
        weakMeasurementRegExp.set(regexp, transformed);
      }
      const groupInfos = transformed.getExtra();
      const measurementRegExp = transformed.toRegExp();
      return { measurementRegExp, groupInfos };
    }
    function makeIndicesArray(measuredResult, groupInfos) {
      const matchStart = measuredResult.index;
      const matchEnd = matchStart + measuredResult[0].length;
      const hasGroups = !!measuredResult.groups;
      const indicesArray = [];
      const groups = hasGroups ? Object.create(null) : void 0;
      makeDataProperty(indicesArray, 0, [matchStart, matchEnd]);
      for (const groupInfo of groupInfos) {
        let indices;
        if (measuredResult[groupInfo.newGroupNumber] !== void 0) {
          let startIndex = matchStart;
          if (groupInfo.measurementGroups) {
            for (const measurementGroup of groupInfo.measurementGroups) {
              startIndex += measuredResult[measurementGroup].length;
            }
          }
          const endIndex = startIndex + measuredResult[groupInfo.newGroupNumber].length;
          indices = [startIndex, endIndex];
        }
        makeDataProperty(indicesArray, groupInfo.oldGroupNumber, indices);
        if (groups && groupInfo.groupName !== void 0) {
          makeDataProperty(groups, groupInfo.groupName, indices);
        }
      }
      makeDataProperty(indicesArray, "groups", groups);
      return indicesArray;
    }
    function makeDataProperty(result, key, value) {
      const existingDesc = Object.getOwnPropertyDescriptor(result, key);
      if (existingDesc ? existingDesc.configurable : Object.isExtensible(result)) {
        const newDesc = {
          enumerable: existingDesc ? existingDesc.enumerable : true,
          configurable: existingDesc ? existingDesc.configurable : true,
          writable: true,
          value
        };
        Object.defineProperty(result, key, newDesc);
      }
    }
    var groupRenumbers;
    var hasBackreferences = false;
    var nodesContainingCapturingGroup = new Set();
    var containsCapturingGroupStack = [];
    var containsCapturingGroup = false;
    var nextNewGroupNumber = 1;
    var measurementGroupStack = [];
    var measurementGroupsForGroup = new Map();
    var newGroupNumberForGroup = new Map();
    var handlers = {
      init() {
        hasBackreferences = false;
        nodesContainingCapturingGroup.clear();
        containsCapturingGroupStack.length = 0;
        containsCapturingGroup = false;
        nextNewGroupNumber = 1;
        measurementGroupStack.length = 0;
        measurementGroupsForGroup.clear();
        newGroupNumberForGroup.clear();
        groupRenumbers = [];
      },
      RegExp(path) {
        regexp_tree_1.traverse(path.node, visitor);
        if (nodesContainingCapturingGroup.size > 0) {
          regexp_tree_1.transform(path.node, builder);
          regexp_tree_1.transform(path.node, groupRenumberer);
          if (hasBackreferences) {
            regexp_tree_1.transform(path.node, backreferenceRenumberer);
          }
        }
        return false;
      }
    };
    var nodeCallbacks = {
      pre(path) {
        containsCapturingGroupStack.push(containsCapturingGroup);
        containsCapturingGroup = path.node.type === "Group" && path.node.capturing;
      },
      post(path) {
        if (containsCapturingGroup) {
          nodesContainingCapturingGroup.add(path.node);
        }
        containsCapturingGroup = containsCapturingGroupStack.pop() || containsCapturingGroup;
      }
    };
    var visitor = {
      Alternative: nodeCallbacks,
      Disjunction: nodeCallbacks,
      Assertion: nodeCallbacks,
      Group: nodeCallbacks,
      Repetition: nodeCallbacks,
      Backreference(path) {
        hasBackreferences = true;
      }
    };
    var builder = {
      Alternative(path) {
        if (nodesContainingCapturingGroup.has(path.node)) {
          let lastMeasurementIndex = 0;
          let pendingTerms = [];
          const measurementGroups = [];
          const terms = [];
          for (let i = 0; i < path.node.expressions.length; i++) {
            const term = path.node.expressions[i];
            if (nodesContainingCapturingGroup.has(term)) {
              if (i > lastMeasurementIndex) {
                const measurementGroup = {
                  type: "Group",
                  capturing: true,
                  number: -1,
                  expression: pendingTerms.length > 1 ? { type: "Alternative", expressions: pendingTerms } : pendingTerms.length === 1 ? pendingTerms[0] : null
                };
                terms.push(measurementGroup);
                measurementGroups.push(measurementGroup);
                lastMeasurementIndex = i;
                pendingTerms = [];
              }
              measurementGroupStack.push(measurementGroups);
              regexp_tree_1.transform(term, builder);
              measurementGroupStack.pop();
              pendingTerms.push(term);
              continue;
            }
            pendingTerms.push(term);
          }
          path.update({ expressions: terms.concat(pendingTerms) });
        }
        return false;
      },
      Group(path) {
        if (!path.node.capturing)
          return;
        measurementGroupsForGroup.set(path.node, getMeasurementGroups());
      }
    };
    var groupRenumberer = {
      Group(path) {
        if (!groupRenumbers)
          throw new Error("Not initialized.");
        if (!path.node.capturing)
          return;
        const oldGroupNumber = path.node.number;
        const newGroupNumber = nextNewGroupNumber++;
        const measurementGroups = measurementGroupsForGroup.get(path.node);
        if (oldGroupNumber !== -1) {
          groupRenumbers.push({
            oldGroupNumber,
            newGroupNumber,
            measurementGroups: measurementGroups && measurementGroups.map((group) => group.number),
            groupName: path.node.name
          });
          newGroupNumberForGroup.set(oldGroupNumber, newGroupNumber);
        }
        path.update({ number: newGroupNumber });
      }
    };
    var backreferenceRenumberer = {
      Backreference(path) {
        const newGroupNumber = newGroupNumberForGroup.get(path.node.number);
        if (newGroupNumber) {
          if (path.node.kind === "number") {
            path.update({
              number: newGroupNumber,
              reference: newGroupNumber
            });
          } else {
            path.update({
              number: newGroupNumber
            });
          }
        }
      }
    };
    function getMeasurementGroups() {
      const measurementGroups = [];
      for (const array of measurementGroupStack) {
        for (const item of array) {
          measurementGroups.push(item);
        }
      }
      return measurementGroups;
    }
    function transformMeasurementGroups(ast) {
      const result = regexp_tree_1.transform(ast, handlers);
      return new regexp_tree_1.TransformResult(result.getAST(), groupRenumbers);
    }
    module2.exports = exec;
  }
});

// node_modules/regexp-match-indices/polyfill.js
var require_polyfill = __commonJS({
  "node_modules/regexp-match-indices/polyfill.js"(exports, module2) {
    "use strict";
    var nativeExec = require_native();
    var implementation = require_implementation();
    function getPolyfill() {
      const re = new RegExp("a");
      const match = nativeExec.call(re, "a");
      if (match.indices) {
        return nativeExec;
      }
      return implementation;
    }
    module2.exports = getPolyfill;
  }
});

// node_modules/regexp-match-indices/shim.js
var require_shim = __commonJS({
  "node_modules/regexp-match-indices/shim.js"(exports, module2) {
    "use strict";
    var getPolyfill = require_polyfill();
    function shim() {
      const polyfill = getPolyfill();
      if (RegExp.prototype.exec !== polyfill) {
        RegExp.prototype.exec = polyfill;
      }
    }
    module2.exports = shim;
  }
});

// node_modules/regexp-match-indices/index.js
var require_regexp_match_indices = __commonJS({
  "node_modules/regexp-match-indices/index.js"(exports, module2) {
    "use strict";
    var implementation = require_implementation();
    var native = require_native();
    var getPolyfill = require_polyfill();
    var shim = require_shim();
    var config = require_config();
    var polyfill = getPolyfill();
    function exec(regexp, string) {
      return polyfill.call(regexp, string);
    }
    exec.implementation = implementation;
    exec.native = native;
    exec.getPolyfill = getPolyfill;
    exec.shim = shim;
    exec.config = config;
    (function(exec2) {
    })(exec || (exec = {}));
    module2.exports = exec;
  }
});

// node_modules/@simonwep/pickr/dist/pickr.min.js
var require_pickr_min = __commonJS({
  "node_modules/@simonwep/pickr/dist/pickr.min.js"(exports, module2) {
    !function(t3, e) {
      typeof exports == "object" && typeof module2 == "object" ? module2.exports = e() : typeof define == "function" && define.amd ? define([], e) : typeof exports == "object" ? exports.Pickr = e() : t3.Pickr = e();
    }(self, function() {
      return (() => {
        "use strict";
        var t3 = { d: (e2, o2) => {
          for (var n2 in o2)
            t3.o(o2, n2) && !t3.o(e2, n2) && Object.defineProperty(e2, n2, { enumerable: true, get: o2[n2] });
        }, o: (t4, e2) => Object.prototype.hasOwnProperty.call(t4, e2), r: (t4) => {
          typeof Symbol != "undefined" && Symbol.toStringTag && Object.defineProperty(t4, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(t4, "__esModule", { value: true });
        } }, e = {};
        t3.d(e, { default: () => x });
        var o = {};
        function n(t4, e2, o2, n2) {
          let i2 = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : {};
          e2 instanceof HTMLCollection || e2 instanceof NodeList ? e2 = Array.from(e2) : Array.isArray(e2) || (e2 = [e2]), Array.isArray(o2) || (o2 = [o2]);
          for (const s2 of e2)
            for (const e3 of o2)
              s2[t4](e3, n2, { capture: false, ...i2 });
          return Array.prototype.slice.call(arguments, 1);
        }
        t3.r(o), t3.d(o, { adjustableInputNumbers: () => p, createElementFromString: () => r, createFromTemplate: () => a, eventPath: () => l, off: () => s, on: () => i, resolveElement: () => c });
        const i = n.bind(null, "addEventListener"), s = n.bind(null, "removeEventListener");
        function r(t4) {
          const e2 = document.createElement("div");
          return e2.innerHTML = t4.trim(), e2.firstElementChild;
        }
        function a(t4) {
          const e2 = (t5, e3) => {
            const o3 = t5.getAttribute(e3);
            return t5.removeAttribute(e3), o3;
          }, o2 = function(t5) {
            let n2 = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
            const i2 = e2(t5, ":obj"), s2 = e2(t5, ":ref"), r2 = i2 ? n2[i2] = {} : n2;
            s2 && (n2[s2] = t5);
            for (const n3 of Array.from(t5.children)) {
              const t6 = e2(n3, ":arr"), i3 = o2(n3, t6 ? {} : r2);
              t6 && (r2[t6] || (r2[t6] = [])).push(Object.keys(i3).length ? i3 : n3);
            }
            return n2;
          };
          return o2(r(t4));
        }
        function l(t4) {
          let e2 = t4.path || t4.composedPath && t4.composedPath();
          if (e2)
            return e2;
          let o2 = t4.target.parentElement;
          for (e2 = [t4.target, o2]; o2 = o2.parentElement; )
            e2.push(o2);
          return e2.push(document, window), e2;
        }
        function c(t4) {
          return t4 instanceof Element ? t4 : typeof t4 == "string" ? t4.split(/>>/g).reduce((t5, e2, o2, n2) => (t5 = t5.querySelector(e2), o2 < n2.length - 1 ? t5.shadowRoot : t5), document) : null;
        }
        function p(t4) {
          let e2 = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : (t5) => t5;
          function o2(o3) {
            const n2 = [1e-3, 0.01, 0.1][Number(o3.shiftKey || 2 * o3.ctrlKey)] * (o3.deltaY < 0 ? 1 : -1);
            let i2 = 0, s2 = t4.selectionStart;
            t4.value = t4.value.replace(/[\d.]+/g, (t5, o4) => o4 <= s2 && o4 + t5.length >= s2 ? (s2 = o4, e2(Number(t5), n2, i2)) : (i2++, t5)), t4.focus(), t4.setSelectionRange(s2, s2), o3.preventDefault(), t4.dispatchEvent(new Event("input"));
          }
          i(t4, "focus", () => i(window, "wheel", o2, { passive: false })), i(t4, "blur", () => s(window, "wheel", o2));
        }
        const { min: h, max: u, floor: d, round: v } = Math;
        function m(t4, e2, o2) {
          e2 /= 100, o2 /= 100;
          const n2 = d(t4 = t4 / 360 * 6), i2 = t4 - n2, s2 = o2 * (1 - e2), r2 = o2 * (1 - i2 * e2), a2 = o2 * (1 - (1 - i2) * e2), l2 = n2 % 6;
          return [255 * [o2, r2, s2, s2, a2, o2][l2], 255 * [a2, o2, o2, r2, s2, s2][l2], 255 * [s2, s2, a2, o2, o2, r2][l2]];
        }
        function f(t4, e2, o2) {
          return m(t4, e2, o2).map((t5) => v(t5).toString(16).padStart(2, "0"));
        }
        function g(t4, e2, o2) {
          const n2 = m(t4, e2, o2), i2 = n2[0] / 255, s2 = n2[1] / 255, r2 = n2[2] / 255, a2 = h(1 - i2, 1 - s2, 1 - r2);
          return [100 * (a2 === 1 ? 0 : (1 - i2 - a2) / (1 - a2)), 100 * (a2 === 1 ? 0 : (1 - s2 - a2) / (1 - a2)), 100 * (a2 === 1 ? 0 : (1 - r2 - a2) / (1 - a2)), 100 * a2];
        }
        function b(t4, e2, o2) {
          const n2 = (2 - (e2 /= 100)) * (o2 /= 100) / 2;
          return n2 !== 0 && (e2 = n2 === 1 ? 0 : n2 < 0.5 ? e2 * o2 / (2 * n2) : e2 * o2 / (2 - 2 * n2)), [t4, 100 * e2, 100 * n2];
        }
        function y(t4, e2, o2) {
          const n2 = h(t4 /= 255, e2 /= 255, o2 /= 255), i2 = u(t4, e2, o2), s2 = i2 - n2;
          let r2, a2;
          if (s2 === 0)
            r2 = a2 = 0;
          else {
            a2 = s2 / i2;
            const n3 = ((i2 - t4) / 6 + s2 / 2) / s2, l2 = ((i2 - e2) / 6 + s2 / 2) / s2, c2 = ((i2 - o2) / 6 + s2 / 2) / s2;
            t4 === i2 ? r2 = c2 - l2 : e2 === i2 ? r2 = 1 / 3 + n3 - c2 : o2 === i2 && (r2 = 2 / 3 + l2 - n3), r2 < 0 ? r2 += 1 : r2 > 1 && (r2 -= 1);
          }
          return [360 * r2, 100 * a2, 100 * i2];
        }
        function _(t4, e2, o2, n2) {
          e2 /= 100, o2 /= 100;
          return [...y(255 * (1 - h(1, (t4 /= 100) * (1 - (n2 /= 100)) + n2)), 255 * (1 - h(1, e2 * (1 - n2) + n2)), 255 * (1 - h(1, o2 * (1 - n2) + n2)))];
        }
        function w(t4, e2, o2) {
          e2 /= 100;
          const n2 = 2 * (e2 *= (o2 /= 100) < 0.5 ? o2 : 1 - o2) / (o2 + e2) * 100, i2 = 100 * (o2 + e2);
          return [t4, isNaN(n2) ? 0 : n2, i2];
        }
        function A(t4) {
          return y(...t4.match(/.{2}/g).map((t5) => parseInt(t5, 16)));
        }
        function C(t4) {
          t4 = t4.match(/^[a-zA-Z]+$/) ? function(t5) {
            if (t5.toLowerCase() === "black")
              return "#000";
            const e3 = document.createElement("canvas").getContext("2d");
            return e3.fillStyle = t5, e3.fillStyle === "#000" ? null : e3.fillStyle;
          }(t4) : t4;
          const e2 = { cmyk: /^cmyk[\D]+([\d.]+)[\D]+([\d.]+)[\D]+([\d.]+)[\D]+([\d.]+)/i, rgba: /^((rgba)|rgb)[\D]+([\d.]+)[\D]+([\d.]+)[\D]+([\d.]+)[\D]*?([\d.]+|$)/i, hsla: /^((hsla)|hsl)[\D]+([\d.]+)[\D]+([\d.]+)[\D]+([\d.]+)[\D]*?([\d.]+|$)/i, hsva: /^((hsva)|hsv)[\D]+([\d.]+)[\D]+([\d.]+)[\D]+([\d.]+)[\D]*?([\d.]+|$)/i, hexa: /^#?(([\dA-Fa-f]{3,4})|([\dA-Fa-f]{6})|([\dA-Fa-f]{8}))$/i }, o2 = (t5) => t5.map((t6) => /^(|\d+)\.\d+|\d+$/.test(t6) ? Number(t6) : void 0);
          let n2;
          t:
            for (const i2 in e2) {
              if (!(n2 = e2[i2].exec(t4)))
                continue;
              const s2 = (t5) => !!n2[2] == (typeof t5 == "number");
              switch (i2) {
                case "cmyk": {
                  const [, t5, e3, s3, r2] = o2(n2);
                  if (t5 > 100 || e3 > 100 || s3 > 100 || r2 > 100)
                    break t;
                  return { values: _(t5, e3, s3, r2), type: i2 };
                }
                case "rgba": {
                  const [, , , t5, e3, r2, a2] = o2(n2);
                  if (t5 > 255 || e3 > 255 || r2 > 255 || a2 < 0 || a2 > 1 || !s2(a2))
                    break t;
                  return { values: [...y(t5, e3, r2), a2], a: a2, type: i2 };
                }
                case "hexa": {
                  let [, t5] = n2;
                  t5.length !== 4 && t5.length !== 3 || (t5 = t5.split("").map((t6) => t6 + t6).join(""));
                  const e3 = t5.substring(0, 6);
                  let o3 = t5.substring(6);
                  return o3 = o3 ? parseInt(o3, 16) / 255 : void 0, { values: [...A(e3), o3], a: o3, type: i2 };
                }
                case "hsla": {
                  const [, , , t5, e3, r2, a2] = o2(n2);
                  if (t5 > 360 || e3 > 100 || r2 > 100 || a2 < 0 || a2 > 1 || !s2(a2))
                    break t;
                  return { values: [...w(t5, e3, r2), a2], a: a2, type: i2 };
                }
                case "hsva": {
                  const [, , , t5, e3, r2, a2] = o2(n2);
                  if (t5 > 360 || e3 > 100 || r2 > 100 || a2 < 0 || a2 > 1 || !s2(a2))
                    break t;
                  return { values: [t5, e3, r2, a2], a: a2, type: i2 };
                }
              }
            }
          return { values: null, type: null };
        }
        function $() {
          let t4 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0, e2 = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0, o2 = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0, n2 = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 1;
          const i2 = (t5, e3) => function() {
            let o3 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : -1;
            return e3(~o3 ? t5.map((t6) => Number(t6.toFixed(o3))) : t5);
          }, s2 = { h: t4, s: e2, v: o2, a: n2, toHSVA() {
            const t5 = [s2.h, s2.s, s2.v, s2.a];
            return t5.toString = i2(t5, (t6) => `hsva(${t6[0]}, ${t6[1]}%, ${t6[2]}%, ${s2.a})`), t5;
          }, toHSLA() {
            const t5 = [...b(s2.h, s2.s, s2.v), s2.a];
            return t5.toString = i2(t5, (t6) => `hsla(${t6[0]}, ${t6[1]}%, ${t6[2]}%, ${s2.a})`), t5;
          }, toRGBA() {
            const t5 = [...m(s2.h, s2.s, s2.v), s2.a];
            return t5.toString = i2(t5, (t6) => `rgba(${t6[0]}, ${t6[1]}, ${t6[2]}, ${s2.a})`), t5;
          }, toCMYK() {
            const t5 = g(s2.h, s2.s, s2.v);
            return t5.toString = i2(t5, (t6) => `cmyk(${t6[0]}%, ${t6[1]}%, ${t6[2]}%, ${t6[3]}%)`), t5;
          }, toHEXA() {
            const t5 = f(s2.h, s2.s, s2.v), e3 = s2.a >= 1 ? "" : Number((255 * s2.a).toFixed(0)).toString(16).toUpperCase().padStart(2, "0");
            return e3 && t5.push(e3), t5.toString = () => `#${t5.join("").toUpperCase()}`, t5;
          }, clone: () => $(s2.h, s2.s, s2.v, s2.a) };
          return s2;
        }
        const k = (t4) => Math.max(Math.min(t4, 1), 0);
        function S(t4) {
          const e2 = { options: Object.assign({ lock: null, onchange: () => 0, onstop: () => 0 }, t4), _keyboard(t5) {
            const { options: o3 } = e2, { type: n3, key: i2 } = t5;
            if (document.activeElement === o3.wrapper) {
              const { lock: o4 } = e2.options, s2 = i2 === "ArrowUp", r3 = i2 === "ArrowRight", a2 = i2 === "ArrowDown", l2 = i2 === "ArrowLeft";
              if (n3 === "keydown" && (s2 || r3 || a2 || l2)) {
                let n4 = 0, i3 = 0;
                o4 === "v" ? n4 = s2 || r3 ? 1 : -1 : o4 === "h" ? n4 = s2 || r3 ? -1 : 1 : (i3 = s2 ? -1 : a2 ? 1 : 0, n4 = l2 ? -1 : r3 ? 1 : 0), e2.update(k(e2.cache.x + 0.01 * n4), k(e2.cache.y + 0.01 * i3)), t5.preventDefault();
              } else
                i2.startsWith("Arrow") && (e2.options.onstop(), t5.preventDefault());
            }
          }, _tapstart(t5) {
            i(document, ["mouseup", "touchend", "touchcancel"], e2._tapstop), i(document, ["mousemove", "touchmove"], e2._tapmove), t5.cancelable && t5.preventDefault(), e2._tapmove(t5);
          }, _tapmove(t5) {
            const { options: o3, cache: n3 } = e2, { lock: i2, element: s2, wrapper: r3 } = o3, a2 = r3.getBoundingClientRect();
            let l2 = 0, c2 = 0;
            if (t5) {
              const e3 = t5 && t5.touches && t5.touches[0];
              l2 = t5 ? (e3 || t5).clientX : 0, c2 = t5 ? (e3 || t5).clientY : 0, l2 < a2.left ? l2 = a2.left : l2 > a2.left + a2.width && (l2 = a2.left + a2.width), c2 < a2.top ? c2 = a2.top : c2 > a2.top + a2.height && (c2 = a2.top + a2.height), l2 -= a2.left, c2 -= a2.top;
            } else
              n3 && (l2 = n3.x * a2.width, c2 = n3.y * a2.height);
            i2 !== "h" && (s2.style.left = `calc(${l2 / a2.width * 100}% - ${s2.offsetWidth / 2}px)`), i2 !== "v" && (s2.style.top = `calc(${c2 / a2.height * 100}% - ${s2.offsetHeight / 2}px)`), e2.cache = { x: l2 / a2.width, y: c2 / a2.height };
            const p2 = k(l2 / a2.width), h2 = k(c2 / a2.height);
            switch (i2) {
              case "v":
                return o3.onchange(p2);
              case "h":
                return o3.onchange(h2);
              default:
                return o3.onchange(p2, h2);
            }
          }, _tapstop() {
            e2.options.onstop(), s(document, ["mouseup", "touchend", "touchcancel"], e2._tapstop), s(document, ["mousemove", "touchmove"], e2._tapmove);
          }, trigger() {
            e2._tapmove();
          }, update() {
            let t5 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0, o3 = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
            const { left: n3, top: i2, width: s2, height: r3 } = e2.options.wrapper.getBoundingClientRect();
            e2.options.lock === "h" && (o3 = t5), e2._tapmove({ clientX: n3 + s2 * t5, clientY: i2 + r3 * o3 });
          }, destroy() {
            const { options: t5, _tapstart: o3, _keyboard: n3 } = e2;
            s(document, ["keydown", "keyup"], n3), s([t5.wrapper, t5.element], "mousedown", o3), s([t5.wrapper, t5.element], "touchstart", o3, { passive: false });
          } }, { options: o2, _tapstart: n2, _keyboard: r2 } = e2;
          return i([o2.wrapper, o2.element], "mousedown", n2), i([o2.wrapper, o2.element], "touchstart", n2, { passive: false }), i(document, ["keydown", "keyup"], r2), e2;
        }
        function O() {
          let t4 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
          t4 = Object.assign({ onchange: () => 0, className: "", elements: [] }, t4);
          const e2 = i(t4.elements, "click", (e3) => {
            t4.elements.forEach((o2) => o2.classList[e3.target === o2 ? "add" : "remove"](t4.className)), t4.onchange(e3), e3.stopPropagation();
          });
          return { destroy: () => s(...e2) };
        }
        const E = { variantFlipOrder: { start: "sme", middle: "mse", end: "ems" }, positionFlipOrder: { top: "tbrl", right: "rltb", bottom: "btrl", left: "lrbt" }, position: "bottom", margin: 8 }, L = (t4, e2, o2) => {
          const { container: n2, margin: i2, position: s2, variantFlipOrder: r2, positionFlipOrder: a2 } = { container: document.documentElement.getBoundingClientRect(), ...E, ...o2 }, { left: l2, top: c2 } = e2.style;
          e2.style.left = "0", e2.style.top = "0";
          const p2 = t4.getBoundingClientRect(), h2 = e2.getBoundingClientRect(), u2 = { t: p2.top - h2.height - i2, b: p2.bottom + i2, r: p2.right + i2, l: p2.left - h2.width - i2 }, d2 = { vs: p2.left, vm: p2.left + p2.width / 2 + -h2.width / 2, ve: p2.left + p2.width - h2.width, hs: p2.top, hm: p2.bottom - p2.height / 2 - h2.height / 2, he: p2.bottom - h2.height }, [v2, m2 = "middle"] = s2.split("-"), f2 = a2[v2], g2 = r2[m2], { top: b2, left: y2, bottom: _2, right: w2 } = n2;
          for (const t5 of f2) {
            const o3 = t5 === "t" || t5 === "b", n3 = u2[t5], [i3, s3] = o3 ? ["top", "left"] : ["left", "top"], [r3, a3] = o3 ? [h2.height, h2.width] : [h2.width, h2.height], [l3, c3] = o3 ? [_2, w2] : [w2, _2], [p3, v3] = o3 ? [b2, y2] : [y2, b2];
            if (!(n3 < p3 || n3 + r3 > l3))
              for (const r4 of g2) {
                const l4 = d2[(o3 ? "v" : "h") + r4];
                if (!(l4 < v3 || l4 + a3 > c3))
                  return e2.style[s3] = l4 - h2[s3] + "px", e2.style[i3] = n3 - h2[i3] + "px", t5 + r4;
              }
          }
          return e2.style.left = l2, e2.style.top = c2, null;
        };
        function P(t4, e2, o2) {
          return e2 in t4 ? Object.defineProperty(t4, e2, { value: o2, enumerable: true, configurable: true, writable: true }) : t4[e2] = o2, t4;
        }
        class x {
          constructor(t4) {
            P(this, "_initializingActive", true), P(this, "_recalc", true), P(this, "_nanopop", null), P(this, "_root", null), P(this, "_color", $()), P(this, "_lastColor", $()), P(this, "_swatchColors", []), P(this, "_setupAnimationFrame", null), P(this, "_eventListener", { init: [], save: [], hide: [], show: [], clear: [], change: [], changestop: [], cancel: [], swatchselect: [] }), this.options = t4 = Object.assign({ ...x.DEFAULT_OPTIONS }, t4);
            const { swatches: e2, components: o2, theme: n2, sliders: i2, lockOpacity: s2, padding: r2 } = t4;
            ["nano", "monolith"].includes(n2) && !i2 && (t4.sliders = "h"), o2.interaction || (o2.interaction = {});
            const { preview: a2, opacity: l2, hue: c2, palette: p2 } = o2;
            o2.opacity = !s2 && l2, o2.palette = p2 || a2 || l2 || c2, this._preBuild(), this._buildComponents(), this._bindEvents(), this._finalBuild(), e2 && e2.length && e2.forEach((t5) => this.addSwatch(t5));
            const { button: h2, app: u2 } = this._root;
            this._nanopop = ((t5, e3, o3) => {
              const n3 = typeof t5 != "object" || t5 instanceof HTMLElement ? { reference: t5, popper: e3, ...o3 } : t5;
              return { update() {
                let t6 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : n3;
                const { reference: e4, popper: o4 } = Object.assign(n3, t6);
                if (!o4 || !e4)
                  throw new Error("Popper- or reference-element missing.");
                return L(e4, o4, n3);
              } };
            })(h2, u2, { margin: r2 }), h2.setAttribute("role", "button"), h2.setAttribute("aria-label", this._t("btn:toggle"));
            const d2 = this;
            this._setupAnimationFrame = requestAnimationFrame(function e3() {
              if (!u2.offsetWidth)
                return d2._setupAnimationFrame = requestAnimationFrame(e3);
              d2.setColor(t4.default), d2._rePositioningPicker(), t4.defaultRepresentation && (d2._representation = t4.defaultRepresentation, d2.setColorRepresentation(d2._representation)), t4.showAlways && d2.show(), d2._initializingActive = false, d2._emit("init");
            });
          }
          _preBuild() {
            const { options: t4 } = this;
            for (const e2 of ["el", "container"])
              t4[e2] = c(t4[e2]);
            this._root = ((t5) => {
              const { components: e2, useAsButton: o2, inline: n2, appClass: i2, theme: s2, lockOpacity: r2 } = t5.options, l2 = (t6) => t6 ? "" : 'style="display:none" hidden', c2 = (e3) => t5._t(e3), p2 = a(`
      <div :ref="root" class="pickr">

        ${o2 ? "" : '<button type="button" :ref="button" class="pcr-button"></button>'}

        <div :ref="app" class="pcr-app ${i2 || ""}" data-theme="${s2}" ${n2 ? 'style="position: unset"' : ""} aria-label="${c2("ui:dialog")}" role="window">
          <div class="pcr-selection" ${l2(e2.palette)}>
            <div :obj="preview" class="pcr-color-preview" ${l2(e2.preview)}>
              <button type="button" :ref="lastColor" class="pcr-last-color" aria-label="${c2("btn:last-color")}"></button>
              <div :ref="currentColor" class="pcr-current-color"></div>
            </div>

            <div :obj="palette" class="pcr-color-palette">
              <div :ref="picker" class="pcr-picker"></div>
              <div :ref="palette" class="pcr-palette" tabindex="0" aria-label="${c2("aria:palette")}" role="listbox"></div>
            </div>

            <div :obj="hue" class="pcr-color-chooser" ${l2(e2.hue)}>
              <div :ref="picker" class="pcr-picker"></div>
              <div :ref="slider" class="pcr-hue pcr-slider" tabindex="0" aria-label="${c2("aria:hue")}" role="slider"></div>
            </div>

            <div :obj="opacity" class="pcr-color-opacity" ${l2(e2.opacity)}>
              <div :ref="picker" class="pcr-picker"></div>
              <div :ref="slider" class="pcr-opacity pcr-slider" tabindex="0" aria-label="${c2("aria:opacity")}" role="slider"></div>
            </div>
          </div>

          <div class="pcr-swatches ${e2.palette ? "" : "pcr-last"}" :ref="swatches"></div>

          <div :obj="interaction" class="pcr-interaction" ${l2(Object.keys(e2.interaction).length)}>
            <input :ref="result" class="pcr-result" type="text" spellcheck="false" ${l2(e2.interaction.input)} aria-label="${c2("aria:input")}">

            <input :arr="options" class="pcr-type" data-type="HEXA" value="${r2 ? "HEX" : "HEXA"}" type="button" ${l2(e2.interaction.hex)}>
            <input :arr="options" class="pcr-type" data-type="RGBA" value="${r2 ? "RGB" : "RGBA"}" type="button" ${l2(e2.interaction.rgba)}>
            <input :arr="options" class="pcr-type" data-type="HSLA" value="${r2 ? "HSL" : "HSLA"}" type="button" ${l2(e2.interaction.hsla)}>
            <input :arr="options" class="pcr-type" data-type="HSVA" value="${r2 ? "HSV" : "HSVA"}" type="button" ${l2(e2.interaction.hsva)}>
            <input :arr="options" class="pcr-type" data-type="CMYK" value="CMYK" type="button" ${l2(e2.interaction.cmyk)}>

            <input :ref="save" class="pcr-save" value="${c2("btn:save")}" type="button" ${l2(e2.interaction.save)} aria-label="${c2("aria:btn:save")}">
            <input :ref="cancel" class="pcr-cancel" value="${c2("btn:cancel")}" type="button" ${l2(e2.interaction.cancel)} aria-label="${c2("aria:btn:cancel")}">
            <input :ref="clear" class="pcr-clear" value="${c2("btn:clear")}" type="button" ${l2(e2.interaction.clear)} aria-label="${c2("aria:btn:clear")}">
          </div>
        </div>
      </div>
    `), h2 = p2.interaction;
              return h2.options.find((t6) => !t6.hidden && !t6.classList.add("active")), h2.type = () => h2.options.find((t6) => t6.classList.contains("active")), p2;
            })(this), t4.useAsButton && (this._root.button = t4.el), t4.container.appendChild(this._root.root);
          }
          _finalBuild() {
            const t4 = this.options, e2 = this._root;
            if (t4.container.removeChild(e2.root), t4.inline) {
              const o2 = t4.el.parentElement;
              t4.el.nextSibling ? o2.insertBefore(e2.app, t4.el.nextSibling) : o2.appendChild(e2.app);
            } else
              t4.container.appendChild(e2.app);
            t4.useAsButton ? t4.inline && t4.el.remove() : t4.el.parentNode.replaceChild(e2.root, t4.el), t4.disabled && this.disable(), t4.comparison || (e2.button.style.transition = "none", t4.useAsButton || (e2.preview.lastColor.style.transition = "none")), this.hide();
          }
          _buildComponents() {
            const t4 = this, e2 = this.options.components, o2 = (t4.options.sliders || "v").repeat(2), [n2, i2] = o2.match(/^[vh]+$/g) ? o2 : [], s2 = () => this._color || (this._color = this._lastColor.clone()), r2 = { palette: S({ element: t4._root.palette.picker, wrapper: t4._root.palette.palette, onstop: () => t4._emit("changestop", "slider", t4), onchange(o3, n3) {
              if (!e2.palette)
                return;
              const i3 = s2(), { _root: r3, options: a2 } = t4, { lastColor: l2, currentColor: c2 } = r3.preview;
              t4._recalc && (i3.s = 100 * o3, i3.v = 100 - 100 * n3, i3.v < 0 && (i3.v = 0), t4._updateOutput("slider"));
              const p2 = i3.toRGBA().toString(0);
              this.element.style.background = p2, this.wrapper.style.background = `
                        linear-gradient(to top, rgba(0, 0, 0, ${i3.a}), transparent),
                        linear-gradient(to left, hsla(${i3.h}, 100%, 50%, ${i3.a}), rgba(255, 255, 255, ${i3.a}))
                    `, a2.comparison ? a2.useAsButton || t4._lastColor || l2.style.setProperty("--pcr-color", p2) : (r3.button.style.setProperty("--pcr-color", p2), r3.button.classList.remove("clear"));
              const h2 = i3.toHEXA().toString();
              for (const { el: e3, color: o4 } of t4._swatchColors)
                e3.classList[h2 === o4.toHEXA().toString() ? "add" : "remove"]("pcr-active");
              c2.style.setProperty("--pcr-color", p2);
            } }), hue: S({ lock: i2 === "v" ? "h" : "v", element: t4._root.hue.picker, wrapper: t4._root.hue.slider, onstop: () => t4._emit("changestop", "slider", t4), onchange(o3) {
              if (!e2.hue || !e2.palette)
                return;
              const n3 = s2();
              t4._recalc && (n3.h = 360 * o3), this.element.style.backgroundColor = `hsl(${n3.h}, 100%, 50%)`, r2.palette.trigger();
            } }), opacity: S({ lock: n2 === "v" ? "h" : "v", element: t4._root.opacity.picker, wrapper: t4._root.opacity.slider, onstop: () => t4._emit("changestop", "slider", t4), onchange(o3) {
              if (!e2.opacity || !e2.palette)
                return;
              const n3 = s2();
              t4._recalc && (n3.a = Math.round(100 * o3) / 100), this.element.style.background = `rgba(0, 0, 0, ${n3.a})`, r2.palette.trigger();
            } }), selectable: O({ elements: t4._root.interaction.options, className: "active", onchange(e3) {
              t4._representation = e3.target.getAttribute("data-type").toUpperCase(), t4._recalc && t4._updateOutput("swatch");
            } }) };
            this._components = r2;
          }
          _bindEvents() {
            const { _root: t4, options: e2 } = this, o2 = [i(t4.interaction.clear, "click", () => this._clearColor()), i([t4.interaction.cancel, t4.preview.lastColor], "click", () => {
              this.setHSVA(...(this._lastColor || this._color).toHSVA(), true), this._emit("cancel");
            }), i(t4.interaction.save, "click", () => {
              !this.applyColor() && !e2.showAlways && this.hide();
            }), i(t4.interaction.result, ["keyup", "input"], (t5) => {
              this.setColor(t5.target.value, true) && !this._initializingActive && (this._emit("change", this._color, "input", this), this._emit("changestop", "input", this)), t5.stopImmediatePropagation();
            }), i(t4.interaction.result, ["focus", "blur"], (t5) => {
              this._recalc = t5.type === "blur", this._recalc && this._updateOutput(null);
            }), i([t4.palette.palette, t4.palette.picker, t4.hue.slider, t4.hue.picker, t4.opacity.slider, t4.opacity.picker], ["mousedown", "touchstart"], () => this._recalc = true, { passive: true })];
            if (!e2.showAlways) {
              const n2 = e2.closeWithKey;
              o2.push(i(t4.button, "click", () => this.isOpen() ? this.hide() : this.show()), i(document, "keyup", (t5) => this.isOpen() && (t5.key === n2 || t5.code === n2) && this.hide()), i(document, ["touchstart", "mousedown"], (e3) => {
                this.isOpen() && !l(e3).some((e4) => e4 === t4.app || e4 === t4.button) && this.hide();
              }, { capture: true }));
            }
            if (e2.adjustableNumbers) {
              const e3 = { rgba: [255, 255, 255, 1], hsva: [360, 100, 100, 1], hsla: [360, 100, 100, 1], cmyk: [100, 100, 100, 100] };
              p(t4.interaction.result, (t5, o3, n2) => {
                const i2 = e3[this.getColorRepresentation().toLowerCase()];
                if (i2) {
                  const e4 = i2[n2], s2 = t5 + (e4 >= 100 ? 1e3 * o3 : o3);
                  return s2 <= 0 ? 0 : Number((s2 < e4 ? s2 : e4).toPrecision(3));
                }
                return t5;
              });
            }
            if (e2.autoReposition && !e2.inline) {
              let t5 = null;
              const n2 = this;
              o2.push(i(window, ["scroll", "resize"], () => {
                n2.isOpen() && (e2.closeOnScroll && n2.hide(), t5 === null ? (t5 = setTimeout(() => t5 = null, 100), requestAnimationFrame(function e3() {
                  n2._rePositioningPicker(), t5 !== null && requestAnimationFrame(e3);
                })) : (clearTimeout(t5), t5 = setTimeout(() => t5 = null, 100)));
              }, { capture: true }));
            }
            this._eventBindings = o2;
          }
          _rePositioningPicker() {
            const { options: t4 } = this;
            if (!t4.inline) {
              if (!this._nanopop.update({ container: document.body.getBoundingClientRect(), position: t4.position })) {
                const t5 = this._root.app, e2 = t5.getBoundingClientRect();
                t5.style.top = (window.innerHeight - e2.height) / 2 + "px", t5.style.left = (window.innerWidth - e2.width) / 2 + "px";
              }
            }
          }
          _updateOutput(t4) {
            const { _root: e2, _color: o2, options: n2 } = this;
            if (e2.interaction.type()) {
              const t5 = `to${e2.interaction.type().getAttribute("data-type")}`;
              e2.interaction.result.value = typeof o2[t5] == "function" ? o2[t5]().toString(n2.outputPrecision) : "";
            }
            !this._initializingActive && this._recalc && this._emit("change", o2, t4, this);
          }
          _clearColor() {
            let t4 = arguments.length > 0 && arguments[0] !== void 0 && arguments[0];
            const { _root: e2, options: o2 } = this;
            o2.useAsButton || e2.button.style.setProperty("--pcr-color", "rgba(0, 0, 0, 0.15)"), e2.button.classList.add("clear"), o2.showAlways || this.hide(), this._lastColor = null, this._initializingActive || t4 || (this._emit("save", null), this._emit("clear"));
          }
          _parseLocalColor(t4) {
            const { values: e2, type: o2, a: n2 } = C(t4), { lockOpacity: i2 } = this.options, s2 = n2 !== void 0 && n2 !== 1;
            return e2 && e2.length === 3 && (e2[3] = void 0), { values: !e2 || i2 && s2 ? null : e2, type: o2 };
          }
          _t(t4) {
            return this.options.i18n[t4] || x.I18N_DEFAULTS[t4];
          }
          _emit(t4) {
            for (var e2 = arguments.length, o2 = new Array(e2 > 1 ? e2 - 1 : 0), n2 = 1; n2 < e2; n2++)
              o2[n2 - 1] = arguments[n2];
            this._eventListener[t4].forEach((t5) => t5(...o2, this));
          }
          on(t4, e2) {
            return this._eventListener[t4].push(e2), this;
          }
          off(t4, e2) {
            const o2 = this._eventListener[t4] || [], n2 = o2.indexOf(e2);
            return ~n2 && o2.splice(n2, 1), this;
          }
          addSwatch(t4) {
            const { values: e2 } = this._parseLocalColor(t4);
            if (e2) {
              const { _swatchColors: t5, _root: o2 } = this, n2 = $(...e2), s2 = r(`<button type="button" style="--pcr-color: ${n2.toRGBA().toString(0)}" aria-label="${this._t("btn:swatch")}"/>`);
              return o2.swatches.appendChild(s2), t5.push({ el: s2, color: n2 }), this._eventBindings.push(i(s2, "click", () => {
                this.setHSVA(...n2.toHSVA(), true), this._emit("swatchselect", n2), this._emit("change", n2, "swatch", this);
              })), true;
            }
            return false;
          }
          removeSwatch(t4) {
            const e2 = this._swatchColors[t4];
            if (e2) {
              const { el: o2 } = e2;
              return this._root.swatches.removeChild(o2), this._swatchColors.splice(t4, 1), true;
            }
            return false;
          }
          applyColor() {
            let t4 = arguments.length > 0 && arguments[0] !== void 0 && arguments[0];
            const { preview: e2, button: o2 } = this._root, n2 = this._color.toRGBA().toString(0);
            return e2.lastColor.style.setProperty("--pcr-color", n2), this.options.useAsButton || o2.style.setProperty("--pcr-color", n2), o2.classList.remove("clear"), this._lastColor = this._color.clone(), this._initializingActive || t4 || this._emit("save", this._color), this;
          }
          destroy() {
            cancelAnimationFrame(this._setupAnimationFrame), this._eventBindings.forEach((t4) => s(...t4)), Object.keys(this._components).forEach((t4) => this._components[t4].destroy());
          }
          destroyAndRemove() {
            this.destroy();
            const { root: t4, app: e2 } = this._root;
            t4.parentElement && t4.parentElement.removeChild(t4), e2.parentElement.removeChild(e2), Object.keys(this).forEach((t5) => this[t5] = null);
          }
          hide() {
            return !!this.isOpen() && (this._root.app.classList.remove("visible"), this._emit("hide"), true);
          }
          show() {
            return !this.options.disabled && !this.isOpen() && (this._root.app.classList.add("visible"), this._rePositioningPicker(), this._emit("show", this._color), this);
          }
          isOpen() {
            return this._root.app.classList.contains("visible");
          }
          setHSVA() {
            let t4 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 360, e2 = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0, o2 = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 0, n2 = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 1, i2 = arguments.length > 4 && arguments[4] !== void 0 && arguments[4];
            const s2 = this._recalc;
            if (this._recalc = false, t4 < 0 || t4 > 360 || e2 < 0 || e2 > 100 || o2 < 0 || o2 > 100 || n2 < 0 || n2 > 1)
              return false;
            this._color = $(t4, e2, o2, n2);
            const { hue: r2, opacity: a2, palette: l2 } = this._components;
            return r2.update(t4 / 360), a2.update(n2), l2.update(e2 / 100, 1 - o2 / 100), i2 || this.applyColor(), s2 && this._updateOutput(), this._recalc = s2, true;
          }
          setColor(t4) {
            let e2 = arguments.length > 1 && arguments[1] !== void 0 && arguments[1];
            if (t4 === null)
              return this._clearColor(e2), true;
            const { values: o2, type: n2 } = this._parseLocalColor(t4);
            if (o2) {
              const t5 = n2.toUpperCase(), { options: i2 } = this._root.interaction, s2 = i2.find((e3) => e3.getAttribute("data-type") === t5);
              if (s2 && !s2.hidden)
                for (const t6 of i2)
                  t6.classList[t6 === s2 ? "add" : "remove"]("active");
              return !!this.setHSVA(...o2, e2) && this.setColorRepresentation(t5);
            }
            return false;
          }
          setColorRepresentation(t4) {
            return t4 = t4.toUpperCase(), !!this._root.interaction.options.find((e2) => e2.getAttribute("data-type").startsWith(t4) && !e2.click());
          }
          getColorRepresentation() {
            return this._representation;
          }
          getColor() {
            return this._color;
          }
          getSelectedColor() {
            return this._lastColor;
          }
          getRoot() {
            return this._root;
          }
          disable() {
            return this.hide(), this.options.disabled = true, this._root.button.classList.add("disabled"), this;
          }
          enable() {
            return this.options.disabled = false, this._root.button.classList.remove("disabled"), this;
          }
        }
        return P(x, "utils", o), P(x, "version", "1.8.4"), P(x, "I18N_DEFAULTS", { "ui:dialog": "color picker dialog", "btn:toggle": "toggle color picker dialog", "btn:swatch": "color swatch", "btn:last-color": "use previous color", "btn:save": "Save", "btn:cancel": "Cancel", "btn:clear": "Clear", "aria:btn:save": "save and close", "aria:btn:cancel": "cancel and close", "aria:btn:clear": "clear and close", "aria:input": "color input field", "aria:palette": "color selection area", "aria:hue": "hue selection slider", "aria:opacity": "selection slider" }), P(x, "DEFAULT_OPTIONS", { appClass: null, theme: "classic", useAsButton: false, padding: 8, disabled: false, comparison: true, closeOnScroll: false, outputPrecision: 0, lockOpacity: false, autoReposition: true, container: "body", components: { interaction: {} }, i18n: {}, swatches: null, inline: false, sliders: null, default: "#42445a", defaultRepresentation: null, position: "bottom-middle", adjustableNumbers: true, showAlways: false, closeWithKey: "Escape" }), P(x, "create", (t4) => new x(t4)), e = e.default;
      })();
    });
  }
});

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _(strs, ...args) {
      const code = [strs[0]];
      let i = 0;
      while (i < args.length) {
        addCodeArg(code, args[i]);
        code.push(strs[++i]);
      }
      return new _Code(code);
    }
    exports._ = _;
    var plus = new _Code("+");
    function str(strs, ...args) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code, arg) {
      if (arg instanceof _Code)
        code.push(...arg._items);
      else if (arg instanceof Name)
        code.push(arg);
      else
        code.push(interpolate(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
    }
    exports.strConcat = strConcat;
    function interpolate(x) {
      return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
    }
    function stringify(x) {
      return new _Code(safeStringify(x));
    }
    exports.stringify = stringify;
    function safeStringify(x) {
      return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
    }
    exports.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports.regexpCode = regexpCode;
  }
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "node_modules/ajv/dist/compile/codegen/scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope2 = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope2;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`;
    var ValueScope = class extends Scope2 {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values2 = this._values) {
        return this._reduceValues(values2, (name) => {
          if (name.scopePath === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return (0, code_1._)`${scopeName}${name.scopePath}`;
        });
      }
      scopeCode(values2 = this._values, usedValues, getCode) {
        return this._reduceValues(values2, (name) => {
          if (name.value === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return name.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values2, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values2) {
          const vs = values2[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) {
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name);
            }
            nameSet.set(name, UsedValueState.Completed);
          });
        }
        return code;
      }
    };
    exports.ValueScope = ValueScope;
  }
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "node_modules/ajv/dist/compile/codegen/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error) {
        super();
        this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code) {
        super();
        this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants) {
        this.code = optimizeExpr(this.code, names, constants);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code += "else " + this.else.render(opts);
        return code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new If(not(cond), e instanceof If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        if (!(super.optimizeNames(names, constants) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name, args, async) {
        super();
        this.name = name;
        this.args = args;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
          code += this.catch.render(opts);
        if (this.finally)
          code += this.finally.render(opts);
        return code;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants) {
        var _a, _b;
        super.optimizeNames(names, constants);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error) {
        super();
        this.error = error;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      name(prefix) {
        return this._scope.name(prefix);
      }
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = new Set());
        vs.add(name);
        return name;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
      }
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
      }
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
          if (code.length > 1)
            code.push(",");
          code.push(key);
          if (key !== value || this.opts.es5) {
            code.push(":");
            (0, code_1.addCodeArg)(code, value);
          }
        }
        code.push("}");
        return new code_1._Code(code);
      }
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      else() {
        return this._elseNode(new Else());
      }
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`);
            forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
      }
      endFor() {
        return this._endBlockNode(For);
      }
      label(label) {
        return this._leafNode(new Label(label));
      }
      break(label) {
        return this._leafNode(new Break(label));
      }
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error = this.name("e");
          this._currNode = node.catch = new Catch(error);
          catchCode(error);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      func(name, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x) {
      return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
    }
    exports.not = not;
    var andCode = mappend(exports.operators.AND);
    function and(...args) {
      return args.reduce(andCode);
    }
    exports.and = and;
    var orCode = mappend(exports.operators.OR);
    function or(...args) {
      return args.reduce(orCode);
    }
    exports.or = or;
    function mappend(op) {
      return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
    }
    function par(x) {
      return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
    }
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "node_modules/ajv/dist/compile/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash2 = {};
      for (const item of arr)
        hash2[item] = true;
      return hash2;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it, schema) {
      if (typeof schema == "boolean")
        return schema;
      if (Object.keys(schema).length === 0)
        return true;
      checkUnknownRules(it, schema);
      return !schemaHasRules(schema, it.self.RULES.all);
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema = it.schema) {
      const { opts, self: self2 } = it;
      if (!opts.strictSchema)
        return;
      if (typeof schema === "boolean")
        return;
      const rules = self2.RULES.keywords;
      for (const key in schema) {
        if (!rules[key])
          checkStrictMode(it, `unknown keyword: "${key}"`);
      }
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema, rules) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (rules[key])
          return true;
      return false;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema, RULES) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (key !== "$ref" && RULES.all[key])
          return true;
      return false;
    }
    exports.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
      if (!$data) {
        if (typeof schema == "number" || typeof schema == "boolean")
          return schema;
        if (typeof schema == "string")
          return (0, codegen_1._)`${schema}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str) {
      return unescapeJsonPointer(decodeURIComponent(str));
    }
    exports.unescapeFragment = unescapeFragment;
    function escapeFragment(str) {
      return encodeURIComponent(escapeJsonPointer(str));
    }
    exports.escapeFragment = escapeFragment;
    function escapeJsonPointer(str) {
      if (typeof str == "number")
        return `${str}`;
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x of xs)
          f(x);
      } else {
        f(xs);
      }
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it.self.logger.warn(msg);
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      data: new codegen_1.Name("data"),
      valCxt: new codegen_1.Name("valCxt"),
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      vErrors: new codegen_1.Name("vErrors"),
      errors: new codegen_1.Name("errors"),
      this: new codegen_1.Name("this"),
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports.default = names;
  }
});

// node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS({
  "node_modules/ajv/dist/compile/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
      }
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      const { gen, validateName, schemaEnv } = it;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      const { gen, it } = cxt;
      const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      const { gen, schema, validateName } = it;
      if (schema === false) {
        falseSchemaError(it, false);
      } else if (typeof schema == "object" && schema.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      const { gen, schema } = it;
      if (schema === false) {
        gen.var(valid, false);
        falseSchemaError(it);
      } else {
        gen.var(valid, true);
      }
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      const { gen, data } = it;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "node_modules/ajv/dist/compile/rules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports.getRules = getRules;
  }
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "node_modules/ajv/dist/compile/validate/applicability.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema, self: self2 }, type) {
      const group = self2.RULES.types[type];
      return group && group !== true && shouldUseGroup(schema, group);
    }
    exports.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema, group) {
      return group.rules.some((rule) => shouldUseRule(schema, rule));
    }
    exports.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema, rule) {
      var _a;
      return schema[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema[kwd] !== void 0));
    }
    exports.shouldUseRule = shouldUseRule;
  }
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "node_modules/ajv/dist/compile/validate/dataType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema) {
      const types = getJSONTypes(schema.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      const { gen, data, opts } = it;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it, types, coerceTo);
          else
            reportTypeError(it);
        });
      }
      return checkTypes;
    }
    exports.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes) {
      return coerceTypes ? types.filter((t3) => COERCIBLE.has(t3) || coerceTypes === "array" && t3 === "array") : [];
    }
    function coerceData(it, types, coerceTo) {
      const { gen, data, opts } = it;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t3 of coerceTo) {
        if (COERCIBLE.has(t3) || t3 === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t3);
        }
      }
      gen.else();
      reportTypeError(it);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
      });
      function coerceSpecificType(t3) {
        switch (t3) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t3 in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t3, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema }) => `must be ${schema}`,
      params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._)`{type: ${schema}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      const cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      const { gen, data, schema } = it;
      const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema,
        params: {},
        it
      };
    }
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "node_modules/ajv/dist/compile/validate/defaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it, ty) {
      const { properties: properties2, items } = it.schema;
      if (ty === "object" && properties2) {
        for (const key in properties2) {
          assignDefault(it, key, properties2[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
      }
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties2, missing) {
      return (0, codegen_1.or)(...properties2.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
    }
    exports.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema, keyword, it } = cxt;
      if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
      const alwaysValid = schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
      if (alwaysValid && !it.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema, parentSchema, it } = cxt;
      const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      const validate = !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema) : st === "object" ? schema && typeof schema == "object" && !Array.isArray(schema) : typeof schema == st || allowUndefined && typeof schema == "undefined");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema, opts, self: self2, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self2.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self2.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module2) {
    "use strict";
    module2.exports = function equal(a, b) {
      if (a === b)
        return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor)
          return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length)
            return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i]))
              return false;
          return true;
        }
        if (a.constructor === RegExp)
          return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf)
          return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString)
          return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length)
          return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i]))
            return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key]))
            return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "node_modules/json-schema-traverse/index.js"(exports, module2) {
    "use strict";
    var traverse = module2.exports = function(schema, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema, "", schema);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema && typeof schema == "object" && !Array.isArray(schema)) {
        pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema) {
          var sch = schema[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
          }
        }
        post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str) {
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "node_modules/ajv/dist/compile/resolve.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema, limit = true) {
      if (typeof schema == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema);
      if (!limit)
        return false;
      return countKeys(schema) <= limit;
    }
    exports.inlineRef = inlineRef;
    var REF_KEYWORDS = new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema) {
      for (const key in schema) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema) {
      let count = 0;
      for (const key in schema) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema[key] == "object") {
          (0, util_1.eachItem)(schema[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema, baseId) {
      if (typeof schema == "boolean")
        return {};
      const { schemaId, uriResolver } = this.opts;
      const schId = normalizeId(schema[schemaId] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = new Set();
      traverse(schema, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
          innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports.getSchemaRefs = getSchemaRefs;
  }
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "node_modules/ajv/dist/compile/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors();
    function validateFunctionCode(it) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          topSchemaObjCode(it);
          return;
        }
      }
      validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      const { schema, opts, gen } = it;
      validateFunction(it, () => {
        if (opts.$comment && schema.$comment)
          commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
      });
      return;
    }
    function resetEvaluated(it) {
      const { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema, opts) {
      const schId = typeof schema == "object" && schema[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          subSchemaObjCode(it, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema, self: self2 }) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (self2.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      const { schema, gen, opts } = it;
      if (opts.$comment && schema.$comment)
        commentKeyword(it);
      updateContext(it);
      checkAsyncSchema(it);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it);
      checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      const { schema, errSchemaPath, opts, self: self2 } = it;
      if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self2.RULES)) {
        self2.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it) {
      const { schema, opts } = it;
      if (schema.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
      }
    }
    function updateContext(it) {
      const schId = it.schema[it.opts.schemaId];
      if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
      const msg = schema.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      const { gen, schema, data, allErrors, opts, self: self2 } = it;
      const { RULES } = self2;
      if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it, types);
      gen.block(() => {
        for (const group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it);
          }
          gen.endIf();
        } else {
          iterateKeywords(it, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it, group) {
      const { gen, schema, opts: { useDefaults } } = it;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema, rule)) {
            keywordCode(it, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it, types) {
      if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
      checkContextTypes(it, types);
      if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
      checkKeywordTypes(it, it.dataTypes);
    }
    function checkContextTypes(it, types) {
      if (!types.length)
        return;
      if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
      }
      types.forEach((t3) => {
        if (!includesType(it.dataTypes, t3)) {
          strictTypesError(it, `type "${t3}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it, types);
    }
    function checkMultipleTypes(it, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it, ts) {
      const rules = it.self.RULES.all;
      for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          const { type } = rule.definition;
          if (type.length && !type.some((t3) => hasApplicableType(ts, t3))) {
            strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t3) {
      return ts.includes(t3) || t3 === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it, withTypes) {
      const ts = [];
      for (const t3 of it.dataTypes) {
        if (includesType(withTypes, t3))
          ts.push(t3);
        else if (withTypes.includes("integer") && t3 === "number")
          ts.push("integer");
      }
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
          return;
        if (it.props !== true && schemaCxt.props !== void 0) {
          it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== void 0) {
          it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches2 = RELATIVE_JSON_POINTER.exec($data);
        if (!matches2)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches2[1];
        jsonPointer = matches2[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports.getData = getData;
  }
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "node_modules/ajv/dist/runtime/validation_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema;
        if (typeof env.schema == "object")
          schema = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema === null || schema === void 0 ? void 0 : schema[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema === null || schema === void 0 ? void 0 : schema.$async;
        this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        dataLevel: 0,
        dataTypes: [],
        definedProperties: new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate });
        validate.errors = null;
        validate.schema = sch.schema;
        validate.schemaEnv = sch;
        if (sch.$async)
          validate.$async = true;
        if (this.opts.code.source === true) {
          validate.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate.source)
            validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated);
        }
        sch.validate = validate;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve.call(this, root, ref);
      if (_sch === void 0) {
        const schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId } = this.opts;
        if (schema)
          _sch = new SchemaEnv({ schema, schemaId, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema[schemaId];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema, schemaId, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema === "boolean")
          return;
        const partSchema = schema[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema = partSchema;
        const schId = typeof schema === "object" && schema[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId } = this.opts;
      env = env || new SchemaEnv({ schema, schemaId, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "node_modules/ajv/dist/refs/data.json"(exports, module2) {
    module2.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils2 = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module2) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    var isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu);
    var isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);
    var isPathCharacter = RegExp.prototype.test.bind(/^[\da-z\-._~!$&'()*+,;=:@/]$/iu);
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (code === 48) {
          continue;
        }
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function consumeIsZone(buffer) {
      buffer.length = 0;
      return true;
    }
    function consumeHextets(buffer, address, output) {
      if (buffer.length) {
        const hex = stringArrayToHexStripped(buffer);
        if (hex !== "") {
          address.push(hex);
        } else {
          output.error = true;
          return false;
        }
        buffer.length = 0;
      }
      return true;
    }
    function getIPV6(input) {
      let tokenCount = 0;
      const output = { error: false, address: "", zone: "" };
      const address = [];
      const buffer = [];
      let endipv6Encountered = false;
      let endIpv6 = false;
      let consume = consumeHextets;
      for (let i = 0; i < input.length; i++) {
        const cursor3 = input[i];
        if (cursor3 === "[" || cursor3 === "]") {
          continue;
        }
        if (cursor3 === ":") {
          if (endipv6Encountered === true) {
            endIpv6 = true;
          }
          if (!consume(buffer, address, output)) {
            break;
          }
          if (++tokenCount > 7) {
            output.error = true;
            break;
          }
          if (i > 0 && input[i - 1] === ":") {
            endipv6Encountered = true;
          }
          address.push(":");
          continue;
        } else if (cursor3 === "%") {
          if (!consume(buffer, address, output)) {
            break;
          }
          consume = consumeIsZone;
        } else {
          buffer.push(cursor3);
          continue;
        }
      }
      if (buffer.length) {
        if (consume === consumeIsZone) {
          output.zone = buffer.join("");
        } else if (endIpv6) {
          address.push(buffer.join(""));
        } else {
          address.push(stringArrayToHexStripped(buffer));
        }
      }
      output.address = address.join("");
      return output;
    }
    function normalizeIPv6(host) {
      if (findToken(host, ":") < 2) {
        return { host, isIPV6: false };
      }
      const ipv6 = getIPV6(host);
      if (!ipv6.error) {
        let newHost = ipv6.address;
        let escapedHost = ipv6.address;
        if (ipv6.zone) {
          newHost += "%" + ipv6.zone;
          escapedHost += "%25" + ipv6.zone;
        }
        return { host: newHost, isIPV6: true, escapedHost };
      } else {
        return { host, isIPV6: false };
      }
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === token)
          ind++;
      }
      return ind;
    }
    function removeDotSegments(path) {
      let input = path;
      const output = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output.length !== 0) {
              output.pop();
            }
            output.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output.length !== 0) {
                  output.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else {
          output.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output.join("");
    }
    var HOST_DELIMS = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" };
    var HOST_DELIM_RE = /[@/?#:]/g;
    var HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
    function reescapeHostDelimiters(host, isIP) {
      const re = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
      re.lastIndex = 0;
      return host.replace(re, (ch) => HOST_DELIMS[ch]);
    }
    function normalizePercentEncoding(input, decodeUnreserved = false) {
      if (input.indexOf("%") === -1) {
        return input;
      }
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decodeUnreserved && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        output += input[i];
      }
      return output;
    }
    function normalizePathEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decoded !== "." && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isPathCharacter(input[i])) {
          output += input[i];
        } else {
          output += escape(input[i]);
        }
      }
      return output;
    }
    function escapePreservingEscapes(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        output += escape(input[i]);
      }
      return output;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(component.userinfo);
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = unescape(component.host);
        if (!isIPv4(host)) {
          const ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = reescapeHostDelimiters(host, false);
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        uriTokens.push(":");
        uriTokens.push(String(component.port));
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module2.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      reescapeHostDelimiters,
      normalizePercentEncoding,
      normalizePathEncoding,
      escapePreservingEscapes,
      removeDotSegments,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "node_modules/fast-uri/lib/schemes.js"(exports, module2) {
    "use strict";
    var { isUUID } = require_utils2();
    var URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;
    var supportedSchemeNames = [
      "http",
      "https",
      "ws",
      "wss",
      "urn",
      "urn:uuid"
    ];
    function isValidSchemeName(name) {
      return supportedSchemeNames.indexOf(name) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const [path, query] = wsComponent.resourceName.split("?");
        wsComponent.path = path && path !== "/" ? path : void 0;
        wsComponent.query = query;
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches2 = urnComponent.path.match(URN_REG);
      if (matches2) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches2[1].toLowerCase();
        urnComponent.nss = matches2[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = {
      scheme: "http",
      domainHost: true,
      parse: httpParse,
      serialize: httpSerialize
    };
    var https = {
      scheme: "https",
      domainHost: http.domainHost,
      parse: httpParse,
      serialize: httpSerialize
    };
    var ws = {
      scheme: "ws",
      domainHost: true,
      parse: wsParse,
      serialize: wsSerialize
    };
    var wss = {
      scheme: "wss",
      domainHost: ws.domainHost,
      parse: ws.parse,
      serialize: ws.serialize
    };
    var urn = {
      scheme: "urn",
      parse: urnParse,
      serialize: urnSerialize,
      skipNormalize: true
    };
    var urnuuid = {
      scheme: "urn:uuid",
      parse: urnuuidParse,
      serialize: urnuuidSerialize,
      skipNormalize: true
    };
    var SCHEMES = {
      http,
      https,
      ws,
      wss,
      urn,
      "urn:uuid": urnuuid
    };
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[scheme] || SCHEMES[scheme.toLowerCase()]) || void 0;
    }
    module2.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "node_modules/fast-uri/index.js"(exports, module2) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, escapePreservingEscapes, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils2();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = normalizeString(uri, options);
      } else if (typeof uri === "object") {
        uri = parse(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const resolved = resolveComponent(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true);
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative, options, skipNormalization) {
      const target = {};
      if (!skipNormalization) {
        base = parse(serialize(base, options), options);
        relative = parse(serialize(relative, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative.scheme) {
        target.scheme = relative.scheme;
        target.userinfo = relative.userinfo;
        target.host = relative.host;
        target.port = relative.port;
        target.path = removeDotSegments(relative.path || "");
        target.query = relative.query;
      } else {
        if (relative.userinfo !== void 0 || relative.host !== void 0 || relative.port !== void 0) {
          target.userinfo = relative.userinfo;
          target.host = relative.host;
          target.port = relative.port;
          target.path = removeDotSegments(relative.path || "");
          target.query = relative.query;
        } else {
          if (!relative.path) {
            target.path = base.path;
            if (relative.query !== void 0) {
              target.query = relative.query;
            } else {
              target.query = base.query;
            }
          } else {
            if (relative.path[0] === "/") {
              target.path = removeDotSegments(relative.path);
            } else {
              if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) {
                target.path = "/" + relative.path;
              } else if (!base.path) {
                target.path = relative.path;
              } else {
                target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative.path;
              }
              target.path = removeDotSegments(target.path);
            }
            target.query = relative.query;
          }
          target.userinfo = base.userinfo;
          target.host = base.host;
          target.port = base.port;
        }
        target.scheme = base.scheme;
      }
      target.fragment = relative.fragment;
      return target;
    }
    function equal(uriA, uriB, options) {
      const normalizedA = normalizeComparableURI(uriA, options);
      const normalizedB = normalizeComparableURI(uriB, options);
      return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA.toLowerCase() === normalizedB.toLowerCase();
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize)
        schemeHandler.serialize(component, options);
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = escapePreservingEscapes(component.path);
          if (component.scheme !== void 0) {
            component.path = component.path.split("%3A").join(":");
          }
        } else {
          component.path = normalizePercentEncoding(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", component.query);
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", component.fragment);
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    function getParseError(parsed, matches2) {
      if (matches2[2] !== void 0 && parsed.path && parsed.path[0] !== "/") {
        return 'URI path must start with "/" when authority is present.';
      }
      if (typeof parsed.port === "number" && (parsed.port < 0 || parsed.port > 65535)) {
        return "URI port is malformed.";
      }
      return void 0;
    }
    function parseWithStatus(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let malformedAuthorityOrPort = false;
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const matches2 = uri.match(URI_PARSE);
      if (matches2) {
        parsed.scheme = matches2[1];
        parsed.userinfo = matches2[3];
        parsed.host = matches2[4];
        parsed.port = parseInt(matches2[5], 10);
        parsed.path = matches2[6] || "";
        parsed.query = matches2[7];
        parsed.fragment = matches2[8];
        if (isNaN(parsed.port)) {
          parsed.port = matches2[5];
        }
        const parseError = getParseError(parsed, matches2);
        if (parseError !== void 0) {
          parsed.error = parsed.error || parseError;
          malformedAuthorityOrPort = true;
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const ipv6result = normalizeIPv6(parsed.host);
            parsed.host = ipv6result.host.toLowerCase();
            isIP = ipv6result.isIPV6;
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
          if (parsed.host && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
            try {
              parsed.host = new URL("http://" + parsed.host).hostname;
            } catch (e) {
              parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
            }
          }
        }
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (uri.indexOf("%") !== -1) {
            if (parsed.scheme !== void 0) {
              parsed.scheme = unescape(parsed.scheme);
            }
            if (parsed.host !== void 0) {
              parsed.host = reescapeHostDelimiters(unescape(parsed.host), isIP);
            }
          }
          if (parsed.path) {
            parsed.path = normalizePathEncoding(parsed.path);
          }
          if (parsed.fragment) {
            try {
              parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
            } catch (e) {
              parsed.error = parsed.error || "URI malformed";
            }
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return { parsed, malformedAuthorityOrPort };
    }
    function parse(uri, opts) {
      return parseWithStatus(uri, opts).parsed;
    }
    function normalizeString(uri, opts) {
      return normalizeStringWithStatus(uri, opts).normalized;
    }
    function normalizeStringWithStatus(uri, opts) {
      const { parsed, malformedAuthorityOrPort } = parseWithStatus(uri, opts);
      return {
        normalized: malformedAuthorityOrPort ? uri : serialize(parsed, opts),
        malformedAuthorityOrPort
      };
    }
    function normalizeComparableURI(uri, opts) {
      if (typeof uri === "string") {
        const { normalized, malformedAuthorityOrPort } = normalizeStringWithStatus(uri, opts);
        return malformedAuthorityOrPort ? void 0 : normalized;
      }
      if (typeof uri === "object") {
        return serialize(uri, opts);
      }
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve,
      resolveComponent,
      equal,
      serialize,
      parse
    };
    module2.exports = fastUri;
    module2.exports.default = fastUri;
    module2.exports.fastUri = fastUri;
  }
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "node_modules/ajv/dist/runtime/uri.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv2 = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = Object.create(null);
        this._compilations = new Set();
        this._loading = {};
        this._cache = new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
      }
      defaultMeta() {
        const { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          v = this.getSchema(schemaKeyRef);
          if (!v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
          this.errors = v.errors;
        return valid;
      }
      compile(schema, _meta) {
        const sch = this._addSchema(schema, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      addSchema(schema, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema)) {
          for (const sch of schema)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema === "object") {
          const { schemaId } = this.opts;
          id = schema[schemaId];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
        return this;
      }
      addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema, key, true, _validateSchema);
        return this;
      }
      validateSchema(schema, throwOrLogError) {
        if (typeof schema == "boolean")
          return true;
        let $schema;
        $schema = schema.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t3) => addRule.call(this, k, definition, t3)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      removeKeyword(keyword) {
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      addFormat(name, format) {
        if (typeof format == "string")
          format = new RegExp(format);
        this.formats[name] = format;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules) {
            const rule = rules[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema = keywords[key];
            if ($data && schema)
              keywords[key] = schemaOrData(schema);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
          const sch = schemas[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas[keyRef];
            }
          }
        }
      }
      _addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema == "object") {
          id = schema[schemaId];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
        sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema)
          this.validateSchema(schema, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv2.ValidationError = validation_error_1.default;
    Ajv2.MissingRefError = ref_error_1.default;
    exports.default = Ajv2;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
          this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES } = this;
      let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t3 }) => t3 === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
      }
      RULES.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema) {
      return { anyOf: [schema, $dataRef] };
    }
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/ref.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self: self2 } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self2, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      const { gen, it } = cxt;
      const { allErrors, schemaEnv: env, opts } = it;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
          addEvaluatedFrom(v);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        }
        if (it.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
          }
        }
      }
    }
    exports.callRef = callRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports.default = core;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid3 = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid3}))`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const u = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/required.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, schema, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema.length === 0)
          return;
        const useLoop = schema.length >= opts.loopRequired;
        if (it.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j = gen.let("j");
          cxt.setParams({ i, j });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t3) => t3 === "object" || t3 === "array");
        }
        function loopN(i, j) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/const.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema } = cxt;
        if ($data || schema && typeof schema == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        if (!$data && schema.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      limitNumber_1.default,
      multipleOf_1.default,
      limitLength_1.default,
      pattern_1.default,
      limitProperties_1.default,
      required_1.default,
      limitItems_1.default,
      uniqueItems_1.default,
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports.default = validation;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema, data, keyword, it } = cxt;
      it.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports.validateAdditionalItems = validateAdditionalItems;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema, it } = cxt;
        if (Array.isArray(schema))
          return validateTuple(cxt, "additionalItems", schema);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema);
      if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
      }
    }
    exports.validateTuple = validateTuple;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { schema, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
          continue;
        gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties), () => {
          const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
          cxt.mergeValidEvaluated(schCxt, valid);
        }, () => gen.var(valid, true));
        cxt.ok(valid);
      }
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema === false) {
            deleteAdditional(key);
            return;
          }
          if (schema === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema);
        for (const prop of allProps) {
          it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
          it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties2 = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
        if (properties2.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties2) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it.opts.useDefaults && !it.compositeRule && schema[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
          it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/if.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      const schema = it.schema[keyword];
      return schema !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error,
      code(cxt, ruleType) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self: self2 } = it;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self2.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self2.formats[schema];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self2.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format_1 = require_format();
    var format = [format_1.default];
    exports.default = format;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.contentVocabulary = exports.metadataVocabulary = void 0;
    exports.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// node_modules/ajv/dist/vocabularies/draft7.js
var require_draft7 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft7.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft7Vocabularies = [
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary
    ];
    exports.default = draft7Vocabularies;
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        const { gen, data, schema, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required }) {
            return Array.isArray(required) && required.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/refs/json-schema-draft-07.json
var require_json_schema_draft_07 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-draft-07.json"(exports, module2) {
    module2.exports = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "http://json-schema.org/draft-07/schema#",
      title: "Core schema meta-schema",
      definitions: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $ref: "#" }
        },
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          allOf: [{ $ref: "#/definitions/nonNegativeInteger" }, { default: 0 }]
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      },
      type: ["object", "boolean"],
      properties: {
        $id: {
          type: "string",
          format: "uri-reference"
        },
        $schema: {
          type: "string",
          format: "uri"
        },
        $ref: {
          type: "string",
          format: "uri-reference"
        },
        $comment: {
          type: "string"
        },
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        readOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/definitions/nonNegativeInteger" },
        minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        additionalItems: { $ref: "#" },
        items: {
          anyOf: [{ $ref: "#" }, { $ref: "#/definitions/schemaArray" }],
          default: true
        },
        maxItems: { $ref: "#/definitions/nonNegativeInteger" },
        minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        contains: { $ref: "#" },
        maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
        minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        required: { $ref: "#/definitions/stringArray" },
        additionalProperties: { $ref: "#" },
        definitions: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        properties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependencies: {
          type: "object",
          additionalProperties: {
            anyOf: [{ $ref: "#" }, { $ref: "#/definitions/stringArray" }]
          }
        },
        propertyNames: { $ref: "#" },
        const: true,
        enum: {
          type: "array",
          items: true,
          minItems: 1,
          uniqueItems: true
        },
        type: {
          anyOf: [
            { $ref: "#/definitions/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/definitions/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        format: { type: "string" },
        contentMediaType: { type: "string" },
        contentEncoding: { type: "string" },
        if: { $ref: "#" },
        then: { $ref: "#" },
        else: { $ref: "#" },
        allOf: { $ref: "#/definitions/schemaArray" },
        anyOf: { $ref: "#/definitions/schemaArray" },
        oneOf: { $ref: "#/definitions/schemaArray" },
        not: { $ref: "#" }
      },
      default: true
    };
  }
});

// node_modules/ajv/dist/ajv.js
var require_ajv = __commonJS({
  "node_modules/ajv/dist/ajv.js"(exports, module2) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv = void 0;
    var core_1 = require_core();
    var draft7_1 = require_draft7();
    var discriminator_1 = require_discriminator();
    var draft7MetaSchema = require_json_schema_draft_07();
    var META_SUPPORT_DATA = ["/properties"];
    var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
    var Ajv2 = class extends core_1.default {
      _addVocabularies() {
        super._addVocabularies();
        draft7_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        if (!this.opts.meta)
          return;
        const metaSchema = this.opts.$data ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA) : draft7MetaSchema;
        this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv = Ajv2;
    module2.exports = exports = Ajv2;
    module2.exports.Ajv = Ajv2;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv2;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// src/main.ts
__export(exports, {
  default: () => GlimpsePlugin
});
var import_view9 = __toModule(require("@codemirror/view"));
var import_obsidian5 = __toModule(require("obsidian"));

// src/highlighters/selection.ts
var import_search = __toModule(require("@codemirror/search"));
var import_state2 = __toModule(require("@codemirror/state"));
var import_view2 = __toModule(require("@codemirror/view"));
var import_obsidian = __toModule(require("obsidian"));

// src/highlighters/scrollbar-markers.ts
var import_state = __toModule(require("@codemirror/state"));
var import_view = __toModule(require("@codemirror/view"));
var setMatchPositions = import_state.StateEffect.define();
var matchPositionsField = import_state.StateField.define({
  create: () => [],
  update(positions, tr) {
    for (const e of tr.effects) {
      if (e.is(setMatchPositions))
        return e.value;
    }
    if (tr.docChanged)
      return [];
    return positions;
  }
});
var ScrollbarMarkerView = class {
  constructor(view) {
    this.view = view;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "glimpse-scrollbar-markers";
    view.dom.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.render();
  }
  update(update) {
    if (update.docChanged || update.selectionSet || update.viewportChanged || update.heightChanged) {
      this.render();
      return;
    }
    if (update.startState.field(matchPositionsField) !== update.state.field(matchPositionsField)) {
      this.render();
    }
  }
  render() {
    const positions = this.view.state.field(matchPositionsField);
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!ctx)
      return;
    const scroller = this.view.scrollDOM;
    const clientHeight = scroller.clientHeight;
    const scrollHeight = scroller.scrollHeight;
    if (clientHeight <= 0 || scrollHeight <= 0)
      return;
    const right = this.view.dom.offsetWidth - (scroller.offsetLeft + scroller.offsetWidth);
    canvas.style.right = `${right}px`;
    const dpr = devicePixelRatio;
    const width = 8;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${clientHeight}px`;
    canvas.width = width * dpr;
    canvas.height = clientHeight * dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!positions.length)
      return;
    const accentColor = getComputedStyle(document.body).getPropertyValue("--interactive-accent").trim() || "#5b5bd6";
    const lineHeightEstimate = scrollHeight / this.view.state.doc.lines;
    for (const ratio of positions) {
      const y = ratio * clientHeight;
      const markerH = Math.max(3, lineHeightEstimate / scrollHeight * clientHeight * dpr);
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(0, y * dpr, canvas.width, markerH);
      ctx.globalAlpha = 1;
    }
  }
  destroy() {
    this.canvas.remove();
  }
};
function scrollbarMarkersExtension() {
  return [
    matchPositionsField,
    import_view.ViewPlugin.fromClass(ScrollbarMarkerView)
  ];
}

// src/highlighters/selection.ts
var defaultHighlightOptions = {
  highlightSelectedText: true,
  minSelectionLength: 2,
  maxMatches: 1e3,
  highlightDelay: 200,
  minimapEnabled: true
};
var highlightConfig = import_state2.Facet.define({
  combine(options) {
    return (0, import_state2.combineConfig)(options, defaultHighlightOptions, {
      highlightSelectedText: (a, b) => a != null ? a : b,
      minSelectionLength: Math.min,
      maxMatches: Math.min,
      highlightDelay: Math.max,
      minimapEnabled: (a, b) => a != null ? a : b
    });
  }
});
var highlightCompartment = new import_state2.Compartment();
function highlightSelectionMatches(options) {
  const ext = [matchHighlighter];
  if (options) {
    ext.push(highlightConfig.of({ ...options }));
  }
  return ext;
}
function reconfigureSelectionHighlighter(options) {
  return highlightCompartment.reconfigure(highlightConfig.of({ ...options }));
}
var matchHighlighter = import_view2.ViewPlugin.fromClass(class {
  constructor(view) {
    this.matchLines = new Set();
    this.clearVersion = 0;
    this.updateDebouncer(view);
    this.decorations = this.getDeco(view);
  }
  update(update) {
    if (update.selectionSet || update.docChanged) {
      const expectedVersion = ++this.clearVersion;
      setTimeout(() => {
        if (this.clearVersion !== expectedVersion)
          return;
        this.decorations = import_view2.Decoration.none;
        update.view.update([]);
      }, 150);
      this.delayedGetDeco(update.view);
    }
  }
  updateDebouncer(view) {
    this.highlightDelay = view.state.facet(highlightConfig).highlightDelay;
    this.delayedGetDeco = (0, import_obsidian.debounce)((view2) => {
      this.decorations = this.getDeco(view2);
      view2.update([]);
      const doc = view2.state.doc;
      const totalLines = doc.lines;
      let ratios;
      if (this.matchLines.size > 0 && totalLines > 0) {
        ratios = [...this.matchLines].map((ln) => (ln - 1) / totalLines);
      } else {
        ratios = [];
      }
      this.matchLines.clear();
      view2.dispatch({ effects: setMatchPositions.of(ratios) });
    }, this.highlightDelay);
  }
  getDeco(view) {
    const conf = view.state.facet(highlightConfig);
    if (this.highlightDelay != conf.highlightDelay)
      this.updateDebouncer(view);
    const { state } = view, sel = state.selection;
    if (sel.ranges.length > 1)
      return import_view2.Decoration.none;
    if (!conf.highlightSelectedText)
      return import_view2.Decoration.none;
    const matchType = "string";
    const selFrom = Math.min(sel.main.from, sel.main.to);
    const selTo = Math.max(sel.main.from, sel.main.to);
    const len = selTo - selFrom;
    if (len < conf.minSelectionLength || len > 30)
      return import_view2.Decoration.none;
    const query = state.sliceDoc(selFrom, selTo).trim();
    if (!query)
      return import_view2.Decoration.none;
    const deco = [];
    const caseInsensitive = (s) => s.toLowerCase();
    const cursor3 = new import_search.SearchCursor(state.doc, query, 0, state.doc.length, caseInsensitive);
    while (!cursor3.next().done) {
      const { from, to } = cursor3.value;
      const string = state.sliceDoc(from, to).trim();
      const ln = state.doc.lineAt(from).number;
      this.matchLines.add(ln);
      if (deco.length >= conf.maxMatches)
        continue;
      if (from <= selFrom && to >= selTo) {
        deco.push(import_view2.Decoration.mark({
          class: `cm-current-${matchType}`,
          attributes: { "data-contents": string }
        }).range(from, to));
      } else if (from >= selTo || to <= selFrom) {
        deco.push(import_view2.Decoration.mark({
          class: `cm-matched-${matchType}`,
          attributes: { "data-contents": string }
        }).range(from, to));
      }
    }
    if (deco.length < 1) {
      return import_view2.Decoration.none;
    }
    return import_view2.Decoration.set(deco);
  }
}, {
  decorations: (v) => v.decorations
});

// src/highlighters/static.ts
var import_search2 = __toModule(require("@codemirror/search"));
var import_state3 = __toModule(require("@codemirror/state"));
var import_language = __toModule(require("@codemirror/language"));
var import_view3 = __toModule(require("@codemirror/view"));

// src/highlighters/regexp-cursor.ts
var import_regexp_match_indices = __toModule(require_regexp_match_indices());
var empty = { from: -1, to: -1, match: /.*/.exec("") };
var baseFlags = "gm" + (/x/.unicode == null ? "" : "u");
var RegExpCursor = class {
  constructor(text, query, options, from = 0, to = text.length) {
    this.to = to;
    this.curLine = "";
    this.done = false;
    this.value = empty;
    if (/\\[sWDnr]|\n|\r|\[\^/.test(query))
      return new MultilineRegExpCursor(text, query, options, from, to);
    this.re = new RegExp(query, baseFlags + ((options == null ? void 0 : options.ignoreCase) ? "i" : ""));
    this.iter = text.iter();
    const startLine = text.lineAt(from);
    this.curLineStart = startLine.from;
    this.matchPos = from;
    this.getLine(this.curLineStart);
  }
  getLine(skip) {
    this.iter.next(skip);
    if (this.iter.lineBreak) {
      this.curLine = "";
    } else {
      this.curLine = this.iter.value;
      if (this.curLineStart + this.curLine.length > this.to)
        this.curLine = this.curLine.slice(0, this.to - this.curLineStart);
      this.iter.next();
    }
  }
  nextLine() {
    this.curLineStart = this.curLineStart + this.curLine.length + 1;
    if (this.curLineStart > this.to)
      this.curLine = "";
    else
      this.getLine(0);
  }
  next() {
    for (let off2 = this.matchPos - this.curLineStart; ; ) {
      this.re.lastIndex = off2;
      const match = this.matchPos <= this.to && (0, import_regexp_match_indices.default)(this.re, this.curLine);
      if (match) {
        const from = this.curLineStart + match.index, to = from + match[0].length;
        this.matchPos = to + (from == to ? 1 : 0);
        if (from == this.curLine.length)
          this.nextLine();
        if (from < to || from > this.value.to) {
          this.value = { from, to, match };
          return this;
        }
        off2 = this.matchPos - this.curLineStart;
      } else if (this.curLineStart + this.curLine.length < this.to) {
        this.nextLine();
        off2 = 0;
      } else {
        this.done = true;
        return this;
      }
    }
  }
};
Symbol.iterator;
var flattened = new WeakMap();
var FlattenedDoc = class {
  constructor(from, text) {
    this.from = from;
    this.text = text;
  }
  get to() {
    return this.from + this.text.length;
  }
  static get(doc, from, to) {
    const cached = flattened.get(doc);
    if (!cached || cached.from >= to || cached.to <= from) {
      const flat = new FlattenedDoc(from, doc.sliceString(from, to));
      flattened.set(doc, flat);
      return flat;
    }
    if (cached.from == from && cached.to == to)
      return cached;
    let { text, from: cachedFrom } = cached;
    if (cachedFrom > from) {
      text = doc.sliceString(from, cachedFrom) + text;
      cachedFrom = from;
    }
    if (cached.to < to)
      text += doc.sliceString(cached.to, to);
    flattened.set(doc, new FlattenedDoc(cachedFrom, text));
    return new FlattenedDoc(from, text.slice(from - cachedFrom, to - cachedFrom));
  }
};
var Chunk;
(function(Chunk2) {
  Chunk2[Chunk2["Base"] = 5e3] = "Base";
})(Chunk || (Chunk = {}));
var MultilineRegExpCursor = class {
  constructor(text, query, options, from, to) {
    this.text = text;
    this.to = to;
    this.done = false;
    this.value = empty;
    this.matchPos = from;
    this.re = new RegExp(query, baseFlags + ((options == null ? void 0 : options.ignoreCase) ? "i" : ""));
    this.flat = FlattenedDoc.get(text, from, this.chunkEnd(from + 5e3));
  }
  chunkEnd(pos) {
    return pos >= this.to ? this.to : this.text.lineAt(pos).to;
  }
  next() {
    for (; ; ) {
      const off2 = this.re.lastIndex = this.matchPos - this.flat.from;
      let match = (0, import_regexp_match_indices.default)(this.re, this.flat.text);
      if (match && !match[0] && match.index == off2) {
        this.re.lastIndex = off2 + 1;
        match = (0, import_regexp_match_indices.default)(this.re, this.flat.text);
      }
      if (match && this.flat.to < this.to && match.index + match[0].length > this.flat.text.length - 10)
        match = null;
      if (match) {
        const from = this.flat.from + match.index, to = from + match[0].length;
        this.value = { from, to, match };
        this.matchPos = to + (from == to ? 1 : 0);
        return this;
      } else {
        if (this.flat.to == this.to) {
          this.done = true;
          return this;
        }
        this.flat = FlattenedDoc.get(this.text, this.flat.from, this.chunkEnd(this.flat.from + this.flat.text.length * 2));
      }
    }
  }
};
Symbol.iterator;
if (typeof Symbol != "undefined") {
  RegExpCursor.prototype[Symbol.iterator] = MultilineRegExpCursor.prototype[Symbol.iterator] = function() {
    return this;
  };
}

// src/highlighters/static.ts
var defaultOptions = {
  queries: {},
  queryOrder: [],
  groups: []
};
var staticHighlightConfig = import_state3.Facet.define({
  combine(options) {
    return (0, import_state3.combineConfig)(options, defaultOptions, {
      queries: (a, b) => a || b,
      queryOrder: (a, b) => a || b
    });
  }
});
var staticHighlighterCompartment = new import_state3.Compartment();
function staticHighlighterExtension(plugin) {
  const ext = [staticHighlighter];
  const options = plugin.settings.staticHighlighter;
  ext.push(staticHighlightConfig.of({ ...options }));
  return ext;
}
function buildStyles(plugin) {
  const queries = Object.values(plugin.settings.staticHighlighter.queries);
  const styles = {};
  for (const query of queries) {
    const className = "." + query.class;
    if (!query.color)
      continue;
    styles[className] = { backgroundColor: query.color };
  }
  const theme = import_view3.EditorView.theme(styles);
  return theme;
}
var IconWidget = class extends import_view3.WidgetType {
  constructor(className) {
    super();
    this.className = className;
  }
  toDOM() {
    const headerEl = document.createElement("span");
    this.className && headerEl.addClass(this.className);
    return headerEl;
  }
  ignoreEvent() {
    return true;
  }
};
var staticHighlighter = import_view3.ViewPlugin.fromClass(class {
  constructor(view) {
    const { token, line, group, widget } = this.getDeco(view);
    this.decorations = token;
    this.lineDecorations = line;
    this.groupDecorations = group;
    this.widgetDecorations = widget;
  }
  update(update) {
    const reconfigured = update.startState.facet(staticHighlightConfig) !== update.state.facet(staticHighlightConfig);
    if (update.docChanged || update.viewportChanged || reconfigured) {
      const { token, line, group, widget } = this.getDeco(update.view);
      this.decorations = token;
      this.lineDecorations = line;
      this.groupDecorations = group;
      this.widgetDecorations = widget;
    }
  }
  getDeco(view) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const { state } = view, tokenDecos = [], lineDecos = [], groupDecos = [], widgetDecos = [], lineClasses = {}, queries = Object.values(view.state.facet(staticHighlightConfig).queries);
    for (const part of view.visibleRanges) {
      for (const query of queries) {
        let cursor3;
        try {
          if (query.regex)
            cursor3 = new RegExpCursor(state.doc, query.query, {}, part.from, part.to);
          else
            cursor3 = new import_search2.SearchCursor(state.doc, query.query, part.from, part.to);
        } catch (err) {
          console.debug(err);
          continue;
        }
        while (!cursor3.next().done) {
          const { from, to } = cursor3.value;
          const string = state.sliceDoc(from, to).trim();
          const linePos = (_a = view.state.doc.lineAt(from)) == null ? void 0 : _a.from;
          const syntaxNode = (0, import_language.syntaxTree)(view.state).resolveInner(linePos + 1), nodeProps = syntaxNode.type.prop(import_language.tokenClassNodeProp), excludedSection = ["hmd-codeblock", "hmd-frontmatter"].find((token) => nodeProps == null ? void 0 : nodeProps.split(" ").includes(token));
          if (excludedSection)
            continue;
          if ((_b = query.mark) == null ? void 0 : _b.includes("line")) {
            if (!lineClasses[linePos])
              lineClasses[linePos] = [];
            lineClasses[linePos].push(query.class);
          }
          if (!query.mark || ((_c = query.mark) == null ? void 0 : _c.includes("match"))) {
            const markDeco = import_view3.Decoration.mark({ class: query.class, attributes: { "data-contents": string } });
            tokenDecos.push(markDeco.range(from, to));
          }
          if (((_d = query.mark) == null ? void 0 : _d.includes("start")) || ((_e = query.mark) == null ? void 0 : _e.includes("end"))) {
            const startDeco = import_view3.Decoration.widget({ widget: new IconWidget(query.class + "-start") });
            const endDeco = import_view3.Decoration.widget({ widget: new IconWidget(query.class + "-end") });
            if ((_f = query.mark) == null ? void 0 : _f.includes("start"))
              widgetDecos.push(startDeco.range(from, from));
            if ((_g = query.mark) == null ? void 0 : _g.includes("end"))
              widgetDecos.push(endDeco.range(to, to));
          }
          if ((_h = query.mark) == null ? void 0 : _h.includes("group")) {
            let groups;
            if (cursor3 instanceof RegExpCursor) {
              const match = (_i = cursor3.value) == null ? void 0 : _i.match;
              groups = (_j = match.indices) == null ? void 0 : _j.groups;
            }
            groups && Object.entries(groups).forEach((group) => {
              try {
                const [groupName, [groupFrom, groupTo]] = group;
                const groupDeco = import_view3.Decoration.mark({ class: groupName });
                groupDecos.push(groupDeco.range(linePos + groupFrom, linePos + groupTo));
              } catch (err) {
                console.debug(err);
              }
            });
          }
        }
      }
    }
    Object.entries(lineClasses).forEach(([pos, classes]) => {
      pos = parseInt(pos);
      const lineDeco = import_view3.Decoration.line({ attributes: { class: classes.join(" ") } });
      lineDecos.push(lineDeco.range(pos));
    });
    return {
      line: import_view3.Decoration.set(lineDecos.sort((a, b) => a.from - b.from)),
      token: import_view3.Decoration.set(tokenDecos.sort((a, b) => a.from - b.from)),
      group: import_view3.Decoration.set(groupDecos.sort((a, b) => a.from - b.from)),
      widget: import_view3.Decoration.set(widgetDecos.sort((a, b) => a.from - b.from))
    };
  }
}, {
  provide: (plugin) => [
    import_view3.EditorView.decorations.of((v) => {
      var _a;
      return ((_a = v.plugin(plugin)) == null ? void 0 : _a.lineDecorations) || import_view3.Decoration.none;
    }),
    import_view3.EditorView.decorations.of((v) => {
      var _a;
      return ((_a = v.plugin(plugin)) == null ? void 0 : _a.groupDecorations) || import_view3.Decoration.none;
    }),
    import_view3.EditorView.decorations.of((v) => {
      var _a;
      return ((_a = v.plugin(plugin)) == null ? void 0 : _a.decorations) || import_view3.Decoration.none;
    }),
    import_view3.EditorView.decorations.of((v) => {
      var _a;
      return ((_a = v.plugin(plugin)) == null ? void 0 : _a.widgetDecorations) || import_view3.Decoration.none;
    })
  ]
});

// src/highlighters/minimap.ts
var import_state4 = __toModule(require("@codemirror/state"));
var import_view4 = __toModule(require("@codemirror/view"));
var defaultOptions2 = {
  enabled: true,
  width: 80
};
var minimapConfig = import_state4.Facet.define({
  combine(options) {
    return (0, import_state4.combineConfig)(options, defaultOptions2, {
      enabled: (a, b) => a != null ? a : b,
      width: (a, b) => a != null ? a : b
    });
  }
});
var MinimapView = class {
  constructor(view) {
    this.isDragging = false;
    this.dragStartY = 0;
    this.dragStartScrollTop = 0;
    this.resizeObserver = null;
    this.view = view;
    this.container = document.createElement("div");
    this.container.className = "glimpse-minimap";
    this.container.addEventListener("wheel", this, { passive: false });
    this.canvas = document.createElement("canvas");
    this.canvas.className = "glimpse-minimap-canvas";
    this.container.appendChild(this.canvas);
    this.indicator = document.createElement("div");
    this.indicator.className = "glimpse-minimap-indicator";
    this.container.appendChild(this.indicator);
    this.ctx = this.canvas.getContext("2d");
    const opts = view.state.facet(minimapConfig);
    view.scrollDOM.style.marginRight = `${opts.width}px`;
    view.dom.appendChild(this.container);
    view.scrollDOM.addEventListener("scroll", this);
    this.indicator.addEventListener("mousedown", this);
    this.canvas.addEventListener("mousedown", this);
    this._onMouseMove = (e) => {
      if (this.isDragging)
        this.onDragMove(e);
    };
    this._onMouseUp = () => {
      if (this.isDragging)
        this.onDragEnd();
    };
    document.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("mouseup", this._onMouseUp);
    this.resizeObserver = new ResizeObserver(() => this.render());
    this.resizeObserver.observe(view.scrollDOM);
    this.resizeObserver.observe(view.dom);
    this.render();
  }
  handleEvent(e) {
    if (e.type === "scroll") {
      this.updateIndicator();
    } else if (e.type === "mousedown") {
      const me = e;
      if (me.target === this.indicator) {
        this.onDragStart(me);
      } else if (me.target === this.canvas) {
        this.onCanvasClick(me);
      }
    } else if (e.type === "wheel") {
      const we = e;
      this.view.scrollDOM.scrollTop += we.deltaY;
      we.preventDefault();
    }
  }
  update(update) {
    if (update.docChanged || update.heightChanged || update.configurationChanged || update.selectionSet) {
      this.render();
    } else if (update.viewportChanged) {
      this.updateIndicator();
    }
  }
  destroy() {
    var _a;
    this.view.scrollDOM.style.marginRight = "";
    this.view.scrollDOM.removeEventListener("scroll", this);
    this.indicator.removeEventListener("mousedown", this);
    this.canvas.removeEventListener("mousedown", this);
    this.container.removeEventListener("wheel", this);
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("mouseup", this._onMouseUp);
    (_a = this.resizeObserver) == null ? void 0 : _a.disconnect();
    this.container.remove();
  }
  render() {
    const opts = this.view.state.facet(minimapConfig);
    const scroller = this.view.scrollDOM;
    const canvasHeight = scroller.clientHeight;
    if (canvasHeight <= 0)
      return;
    const dpr = devicePixelRatio;
    const cw = opts.width * dpr;
    const ch = canvasHeight * dpr;
    this.canvas.width = cw;
    this.canvas.height = ch;
    this.canvas.style.width = `${opts.width}px`;
    this.canvas.style.height = `${canvasHeight}px`;
    this.container.style.width = `${opts.width}px`;
    const ctx = this.ctx;
    if (!ctx)
      return;
    const isDark = document.body.hasClass("theme-dark");
    ctx.fillStyle = isDark ? "#1e1e1e" : "#fafafa";
    ctx.fillRect(0, 0, cw, ch);
    const doc = this.view.state.doc;
    const totalLines = doc.lines;
    if (totalLines === 0)
      return;
    const sel = this.view.state.selection.main;
    const cursorLine = this.view.state.doc.lineAt(sel.head);
    const visualLines = [];
    let cursorVisualIdx = -1;
    let lastEmpty = false;
    for (let i = 1; i <= totalLines; i++) {
      const line = doc.line(i);
      const text = line.text;
      if (!text) {
        if (lastEmpty)
          continue;
        lastEmpty = true;
        visualLines.push("");
      } else {
        lastEmpty = false;
        visualLines.push(text);
        if (line.number === cursorLine.number)
          cursorVisualIdx = visualLines.length - 1;
      }
    }
    const visualTotal = visualLines.length;
    if (visualTotal === 0)
      return;
    const lineHeightPx = 3;
    const lineH = lineHeightPx * dpr;
    const vFont = lineH * 0.7;
    let maxLineLen = 0;
    for (const t3 of visualLines) {
      const len = Math.min(t3.length, 200);
      if (len > maxLineLen)
        maxLineLen = len;
    }
    const hFont = maxLineLen > 0 ? cw / (maxLineLen * 0.6) : 8;
    const fontSize = Math.min(vFont, hFont, 8);
    ctx.font = `${fontSize}px "SF Mono", "Cascadia Code", "Consolas", "Monaco", monospace`;
    ctx.textBaseline = "top";
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.clip();
    const accentColor = getComputedStyle(document.body).getPropertyValue("--interactive-accent").trim() || (isDark ? "#6e8bff" : "#5b5bd6");
    const textColor = isDark ? "#d4d4d4" : "#555";
    for (let vi = 0; vi < visualTotal; vi++) {
      const text = visualLines[vi];
      const y = vi * lineH;
      if (vi === cursorVisualIdx) {
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(0, y, cw, Math.max(1, lineH));
        ctx.globalAlpha = 1;
      }
      if (text) {
        ctx.fillStyle = textColor;
        ctx.fillText(text, 0, y);
      }
    }
    ctx.restore();
    this.updateIndicator();
  }
  updateIndicator() {
    const scroller = this.view.scrollDOM;
    const scrollTop = scroller.scrollTop;
    const clientHeight = scroller.clientHeight;
    const scrollHeight = scroller.scrollHeight;
    if (clientHeight <= 0 || scrollHeight <= 0)
      return;
    const indicatorHeight = Math.max(clientHeight / scrollHeight * clientHeight, 10);
    const indicatorTop = scrollTop / scrollHeight * clientHeight;
    this.indicator.style.height = `${indicatorHeight}px`;
    this.indicator.style.top = `${indicatorTop}px`;
  }
  onDragStart(e) {
    this.isDragging = true;
    const indicatorRect = this.indicator.getBoundingClientRect();
    this.dragStartY = e.clientY - indicatorRect.top;
    this.indicator.addClass("dragging");
    e.preventDefault();
  }
  onDragMove(e) {
    if (!this.isDragging)
      return;
    const scroller = this.view.scrollDOM;
    const containerRect = this.container.getBoundingClientRect();
    const indicatorH = parseFloat(this.indicator.style.height) || 10;
    const indicatorTop = e.clientY - containerRect.top - this.dragStartY;
    const maxIndicatorTop = containerRect.height - indicatorH;
    const clampedTop = Math.max(0, Math.min(maxIndicatorTop, indicatorTop));
    const ratio = maxIndicatorTop > 0 ? clampedTop / maxIndicatorTop : 0;
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = ratio * maxScroll;
  }
  onDragEnd() {
    if (!this.isDragging)
      return;
    this.isDragging = false;
    this.indicator.removeClass("dragging");
  }
  onCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, clickY / rect.height));
    const scroller = this.view.scrollDOM;
    scroller.scrollTop = ratio * (scroller.scrollHeight - scroller.clientHeight);
  }
};
function minimapExtension(opts) {
  const options = { ...defaultOptions2, ...opts };
  return [
    minimapConfig.of(options),
    import_view4.ViewPlugin.fromClass(MinimapView)
  ];
}

// src/settings/settings.ts
var DEFAULT_SETTINGS = {
  selectionHighlighter: {
    highlightSelectedText: true,
    maxMatches: 1e3,
    minSelectionLength: 2,
    highlightDelay: 200,
    minimapEnabled: true
  },
  staticHighlighter: {
    queries: {},
    queryOrder: [],
    groups: []
  }
};

// src/settings/ui.ts
var import_state6 = __toModule(require("@codemirror/state"));
var import_view8 = __toModule(require("@codemirror/view"));
var import_pickr = __toModule(require_pickr_min());
var import_obsidian4 = __toModule(require("obsidian"));

// node_modules/sortablejs/modular/sortable.esm.js
function _defineProperty(e, r, t3) {
  return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
    value: t3,
    enumerable: true,
    configurable: true,
    writable: true
  }) : e[r] = t3, e;
}
function _extends() {
  return _extends = Object.assign ? Object.assign.bind() : function(n) {
    for (var e = 1; e < arguments.length; e++) {
      var t3 = arguments[e];
      for (var r in t3)
        ({}).hasOwnProperty.call(t3, r) && (n[r] = t3[r]);
    }
    return n;
  }, _extends.apply(null, arguments);
}
function ownKeys(e, r) {
  var t3 = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function(r2) {
      return Object.getOwnPropertyDescriptor(e, r2).enumerable;
    })), t3.push.apply(t3, o);
  }
  return t3;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t3 = arguments[r] != null ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t3), true).forEach(function(r2) {
      _defineProperty(e, r2, t3[r2]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t3)) : ownKeys(Object(t3)).forEach(function(r2) {
      Object.defineProperty(e, r2, Object.getOwnPropertyDescriptor(t3, r2));
    });
  }
  return e;
}
function _objectWithoutProperties(e, t3) {
  if (e == null)
    return {};
  var o, r, i = _objectWithoutPropertiesLoose(e, t3);
  if (Object.getOwnPropertySymbols) {
    var n = Object.getOwnPropertySymbols(e);
    for (r = 0; r < n.length; r++)
      o = n[r], t3.indexOf(o) === -1 && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]);
  }
  return i;
}
function _objectWithoutPropertiesLoose(r, e) {
  if (r == null)
    return {};
  var t3 = {};
  for (var n in r)
    if ({}.hasOwnProperty.call(r, n)) {
      if (e.indexOf(n) !== -1)
        continue;
      t3[n] = r[n];
    }
  return t3;
}
function _toPrimitive(t3, r) {
  if (typeof t3 != "object" || !t3)
    return t3;
  var e = t3[Symbol.toPrimitive];
  if (e !== void 0) {
    var i = e.call(t3, r || "default");
    if (typeof i != "object")
      return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (r === "string" ? String : Number)(t3);
}
function _toPropertyKey(t3) {
  var i = _toPrimitive(t3, "string");
  return typeof i == "symbol" ? i : i + "";
}
function _typeof(o) {
  "@babel/helpers - typeof";
  return _typeof = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(o2) {
    return typeof o2;
  } : function(o2) {
    return o2 && typeof Symbol == "function" && o2.constructor === Symbol && o2 !== Symbol.prototype ? "symbol" : typeof o2;
  }, _typeof(o);
}
var version = "1.15.7";
function userAgent(pattern) {
  if (typeof window !== "undefined" && window.navigator) {
    return !!/* @__PURE__ */ navigator.userAgent.match(pattern);
  }
}
var IE11OrLess = userAgent(/(?:Trident.*rv[ :]?11\.|msie|iemobile|Windows Phone)/i);
var Edge = userAgent(/Edge/i);
var FireFox = userAgent(/firefox/i);
var Safari = userAgent(/safari/i) && !userAgent(/chrome/i) && !userAgent(/android/i);
var IOS = userAgent(/iP(ad|od|hone)/i);
var ChromeForAndroid = userAgent(/chrome/i) && userAgent(/android/i);
var captureMode = {
  capture: false,
  passive: false
};
function on(el, event, fn) {
  el.addEventListener(event, fn, !IE11OrLess && captureMode);
}
function off(el, event, fn) {
  el.removeEventListener(event, fn, !IE11OrLess && captureMode);
}
function matches(el, selector) {
  if (!selector)
    return;
  selector[0] === ">" && (selector = selector.substring(1));
  if (el) {
    try {
      if (el.matches) {
        return el.matches(selector);
      } else if (el.msMatchesSelector) {
        return el.msMatchesSelector(selector);
      } else if (el.webkitMatchesSelector) {
        return el.webkitMatchesSelector(selector);
      }
    } catch (_) {
      return false;
    }
  }
  return false;
}
function getParentOrHost(el) {
  return el.host && el !== document && el.host.nodeType && el.host !== el ? el.host : el.parentNode;
}
function closest(el, selector, ctx, includeCTX) {
  if (el) {
    ctx = ctx || document;
    do {
      if (selector != null && (selector[0] === ">" ? el.parentNode === ctx && matches(el, selector) : matches(el, selector)) || includeCTX && el === ctx) {
        return el;
      }
      if (el === ctx)
        break;
    } while (el = getParentOrHost(el));
  }
  return null;
}
var R_SPACE = /\s+/g;
function toggleClass(el, name, state) {
  if (el && name) {
    if (el.classList) {
      el.classList[state ? "add" : "remove"](name);
    } else {
      var className = (" " + el.className + " ").replace(R_SPACE, " ").replace(" " + name + " ", " ");
      el.className = (className + (state ? " " + name : "")).replace(R_SPACE, " ");
    }
  }
}
function css(el, prop, val) {
  var style = el && el.style;
  if (style) {
    if (val === void 0) {
      if (document.defaultView && document.defaultView.getComputedStyle) {
        val = document.defaultView.getComputedStyle(el, "");
      } else if (el.currentStyle) {
        val = el.currentStyle;
      }
      return prop === void 0 ? val : val[prop];
    } else {
      if (!(prop in style) && prop.indexOf("webkit") === -1) {
        prop = "-webkit-" + prop;
      }
      style[prop] = val + (typeof val === "string" ? "" : "px");
    }
  }
}
function matrix(el, selfOnly) {
  var appliedTransforms = "";
  if (typeof el === "string") {
    appliedTransforms = el;
  } else {
    do {
      var transform = css(el, "transform");
      if (transform && transform !== "none") {
        appliedTransforms = transform + " " + appliedTransforms;
      }
    } while (!selfOnly && (el = el.parentNode));
  }
  var matrixFn = window.DOMMatrix || window.WebKitCSSMatrix || window.CSSMatrix || window.MSCSSMatrix;
  return matrixFn && new matrixFn(appliedTransforms);
}
function find(ctx, tagName, iterator) {
  if (ctx) {
    var list = ctx.getElementsByTagName(tagName), i = 0, n = list.length;
    if (iterator) {
      for (; i < n; i++) {
        iterator(list[i], i);
      }
    }
    return list;
  }
  return [];
}
function getWindowScrollingElement() {
  var scrollingElement = document.scrollingElement;
  if (scrollingElement) {
    return scrollingElement;
  } else {
    return document.documentElement;
  }
}
function getRect(el, relativeToContainingBlock, relativeToNonStaticParent, undoScale, container) {
  if (!el.getBoundingClientRect && el !== window)
    return;
  var elRect, top, left, bottom, right, height, width;
  if (el !== window && el.parentNode && el !== getWindowScrollingElement()) {
    elRect = el.getBoundingClientRect();
    top = elRect.top;
    left = elRect.left;
    bottom = elRect.bottom;
    right = elRect.right;
    height = elRect.height;
    width = elRect.width;
  } else {
    top = 0;
    left = 0;
    bottom = window.innerHeight;
    right = window.innerWidth;
    height = window.innerHeight;
    width = window.innerWidth;
  }
  if ((relativeToContainingBlock || relativeToNonStaticParent) && el !== window) {
    container = container || el.parentNode;
    if (!IE11OrLess) {
      do {
        if (container && container.getBoundingClientRect && (css(container, "transform") !== "none" || relativeToNonStaticParent && css(container, "position") !== "static")) {
          var containerRect = container.getBoundingClientRect();
          top -= containerRect.top + parseInt(css(container, "border-top-width"));
          left -= containerRect.left + parseInt(css(container, "border-left-width"));
          bottom = top + elRect.height;
          right = left + elRect.width;
          break;
        }
      } while (container = container.parentNode);
    }
  }
  if (undoScale && el !== window) {
    var elMatrix = matrix(container || el), scaleX = elMatrix && elMatrix.a, scaleY = elMatrix && elMatrix.d;
    if (elMatrix) {
      top /= scaleY;
      left /= scaleX;
      width /= scaleX;
      height /= scaleY;
      bottom = top + height;
      right = left + width;
    }
  }
  return {
    top,
    left,
    bottom,
    right,
    width,
    height
  };
}
function isScrolledPast(el, elSide, parentSide) {
  var parent = getParentAutoScrollElement(el, true), elSideVal = getRect(el)[elSide];
  while (parent) {
    var parentSideVal = getRect(parent)[parentSide], visible = void 0;
    if (parentSide === "top" || parentSide === "left") {
      visible = elSideVal >= parentSideVal;
    } else {
      visible = elSideVal <= parentSideVal;
    }
    if (!visible)
      return parent;
    if (parent === getWindowScrollingElement())
      break;
    parent = getParentAutoScrollElement(parent, false);
  }
  return false;
}
function getChild(el, childNum, options, includeDragEl) {
  var currentChild = 0, i = 0, children = el.children;
  while (i < children.length) {
    if (children[i].style.display !== "none" && children[i] !== Sortable.ghost && (includeDragEl || children[i] !== Sortable.dragged) && closest(children[i], options.draggable, el, false)) {
      if (currentChild === childNum) {
        return children[i];
      }
      currentChild++;
    }
    i++;
  }
  return null;
}
function lastChild(el, selector) {
  var last = el.lastElementChild;
  while (last && (last === Sortable.ghost || css(last, "display") === "none" || selector && !matches(last, selector))) {
    last = last.previousElementSibling;
  }
  return last || null;
}
function index(el, selector) {
  var index2 = 0;
  if (!el || !el.parentNode) {
    return -1;
  }
  while (el = el.previousElementSibling) {
    if (el.nodeName.toUpperCase() !== "TEMPLATE" && el !== Sortable.clone && (!selector || matches(el, selector))) {
      index2++;
    }
  }
  return index2;
}
function getRelativeScrollOffset(el) {
  var offsetLeft = 0, offsetTop = 0, winScroller = getWindowScrollingElement();
  if (el) {
    do {
      var elMatrix = matrix(el), scaleX = elMatrix.a, scaleY = elMatrix.d;
      offsetLeft += el.scrollLeft * scaleX;
      offsetTop += el.scrollTop * scaleY;
    } while (el !== winScroller && (el = el.parentNode));
  }
  return [offsetLeft, offsetTop];
}
function indexOfObject(arr, obj) {
  for (var i in arr) {
    if (!arr.hasOwnProperty(i))
      continue;
    for (var key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] === arr[i][key])
        return Number(i);
    }
  }
  return -1;
}
function getParentAutoScrollElement(el, includeSelf) {
  if (!el || !el.getBoundingClientRect)
    return getWindowScrollingElement();
  var elem = el;
  var gotSelf = false;
  do {
    if (elem.clientWidth < elem.scrollWidth || elem.clientHeight < elem.scrollHeight) {
      var elemCSS = css(elem);
      if (elem.clientWidth < elem.scrollWidth && (elemCSS.overflowX == "auto" || elemCSS.overflowX == "scroll") || elem.clientHeight < elem.scrollHeight && (elemCSS.overflowY == "auto" || elemCSS.overflowY == "scroll")) {
        if (!elem.getBoundingClientRect || elem === document.body)
          return getWindowScrollingElement();
        if (gotSelf || includeSelf)
          return elem;
        gotSelf = true;
      }
    }
  } while (elem = elem.parentNode);
  return getWindowScrollingElement();
}
function extend(dst, src) {
  if (dst && src) {
    for (var key in src) {
      if (src.hasOwnProperty(key)) {
        dst[key] = src[key];
      }
    }
  }
  return dst;
}
function isRectEqual(rect1, rect2) {
  return Math.round(rect1.top) === Math.round(rect2.top) && Math.round(rect1.left) === Math.round(rect2.left) && Math.round(rect1.height) === Math.round(rect2.height) && Math.round(rect1.width) === Math.round(rect2.width);
}
var _throttleTimeout;
function throttle(callback, ms) {
  return function() {
    if (!_throttleTimeout) {
      var args = arguments, _this = this;
      if (args.length === 1) {
        callback.call(_this, args[0]);
      } else {
        callback.apply(_this, args);
      }
      _throttleTimeout = setTimeout(function() {
        _throttleTimeout = void 0;
      }, ms);
    }
  };
}
function cancelThrottle() {
  clearTimeout(_throttleTimeout);
  _throttleTimeout = void 0;
}
function scrollBy(el, x, y) {
  el.scrollLeft += x;
  el.scrollTop += y;
}
function clone(el) {
  var Polymer = window.Polymer;
  var $ = window.jQuery || window.Zepto;
  if (Polymer && Polymer.dom) {
    return Polymer.dom(el).cloneNode(true);
  } else if ($) {
    return $(el).clone(true)[0];
  } else {
    return el.cloneNode(true);
  }
}
function getChildContainingRectFromElement(container, options, ghostEl2) {
  var rect = {};
  Array.from(container.children).forEach(function(child) {
    var _rect$left, _rect$top, _rect$right, _rect$bottom;
    if (!closest(child, options.draggable, container, false) || child.animated || child === ghostEl2)
      return;
    var childRect = getRect(child);
    rect.left = Math.min((_rect$left = rect.left) !== null && _rect$left !== void 0 ? _rect$left : Infinity, childRect.left);
    rect.top = Math.min((_rect$top = rect.top) !== null && _rect$top !== void 0 ? _rect$top : Infinity, childRect.top);
    rect.right = Math.max((_rect$right = rect.right) !== null && _rect$right !== void 0 ? _rect$right : -Infinity, childRect.right);
    rect.bottom = Math.max((_rect$bottom = rect.bottom) !== null && _rect$bottom !== void 0 ? _rect$bottom : -Infinity, childRect.bottom);
  });
  rect.width = rect.right - rect.left;
  rect.height = rect.bottom - rect.top;
  rect.x = rect.left;
  rect.y = rect.top;
  return rect;
}
var expando = "Sortable" + new Date().getTime();
function AnimationStateManager() {
  var animationStates = [], animationCallbackId;
  return {
    captureAnimationState: function captureAnimationState() {
      animationStates = [];
      if (!this.options.animation)
        return;
      var children = [].slice.call(this.el.children);
      children.forEach(function(child) {
        if (css(child, "display") === "none" || child === Sortable.ghost)
          return;
        animationStates.push({
          target: child,
          rect: getRect(child)
        });
        var fromRect = _objectSpread2({}, animationStates[animationStates.length - 1].rect);
        if (child.thisAnimationDuration) {
          var childMatrix = matrix(child, true);
          if (childMatrix) {
            fromRect.top -= childMatrix.f;
            fromRect.left -= childMatrix.e;
          }
        }
        child.fromRect = fromRect;
      });
    },
    addAnimationState: function addAnimationState(state) {
      animationStates.push(state);
    },
    removeAnimationState: function removeAnimationState(target) {
      animationStates.splice(indexOfObject(animationStates, {
        target
      }), 1);
    },
    animateAll: function animateAll(callback) {
      var _this = this;
      if (!this.options.animation) {
        clearTimeout(animationCallbackId);
        if (typeof callback === "function")
          callback();
        return;
      }
      var animating = false, animationTime = 0;
      animationStates.forEach(function(state) {
        var time = 0, target = state.target, fromRect = target.fromRect, toRect = getRect(target), prevFromRect = target.prevFromRect, prevToRect = target.prevToRect, animatingRect = state.rect, targetMatrix = matrix(target, true);
        if (targetMatrix) {
          toRect.top -= targetMatrix.f;
          toRect.left -= targetMatrix.e;
        }
        target.toRect = toRect;
        if (target.thisAnimationDuration) {
          if (isRectEqual(prevFromRect, toRect) && !isRectEqual(fromRect, toRect) && (animatingRect.top - toRect.top) / (animatingRect.left - toRect.left) === (fromRect.top - toRect.top) / (fromRect.left - toRect.left)) {
            time = calculateRealTime(animatingRect, prevFromRect, prevToRect, _this.options);
          }
        }
        if (!isRectEqual(toRect, fromRect)) {
          target.prevFromRect = fromRect;
          target.prevToRect = toRect;
          if (!time) {
            time = _this.options.animation;
          }
          _this.animate(target, animatingRect, toRect, time);
        }
        if (time) {
          animating = true;
          animationTime = Math.max(animationTime, time);
          clearTimeout(target.animationResetTimer);
          target.animationResetTimer = setTimeout(function() {
            target.animationTime = 0;
            target.prevFromRect = null;
            target.fromRect = null;
            target.prevToRect = null;
            target.thisAnimationDuration = null;
          }, time);
          target.thisAnimationDuration = time;
        }
      });
      clearTimeout(animationCallbackId);
      if (!animating) {
        if (typeof callback === "function")
          callback();
      } else {
        animationCallbackId = setTimeout(function() {
          if (typeof callback === "function")
            callback();
        }, animationTime);
      }
      animationStates = [];
    },
    animate: function animate(target, currentRect, toRect, duration) {
      if (duration) {
        css(target, "transition", "");
        css(target, "transform", "");
        var elMatrix = matrix(this.el), scaleX = elMatrix && elMatrix.a, scaleY = elMatrix && elMatrix.d, translateX = (currentRect.left - toRect.left) / (scaleX || 1), translateY = (currentRect.top - toRect.top) / (scaleY || 1);
        target.animatingX = !!translateX;
        target.animatingY = !!translateY;
        css(target, "transform", "translate3d(" + translateX + "px," + translateY + "px,0)");
        this.forRepaintDummy = repaint(target);
        css(target, "transition", "transform " + duration + "ms" + (this.options.easing ? " " + this.options.easing : ""));
        css(target, "transform", "translate3d(0,0,0)");
        typeof target.animated === "number" && clearTimeout(target.animated);
        target.animated = setTimeout(function() {
          css(target, "transition", "");
          css(target, "transform", "");
          target.animated = false;
          target.animatingX = false;
          target.animatingY = false;
        }, duration);
      }
    }
  };
}
function repaint(target) {
  return target.offsetWidth;
}
function calculateRealTime(animatingRect, fromRect, toRect, options) {
  return Math.sqrt(Math.pow(fromRect.top - animatingRect.top, 2) + Math.pow(fromRect.left - animatingRect.left, 2)) / Math.sqrt(Math.pow(fromRect.top - toRect.top, 2) + Math.pow(fromRect.left - toRect.left, 2)) * options.animation;
}
var plugins = [];
var defaults = {
  initializeByDefault: true
};
var PluginManager = {
  mount: function mount(plugin) {
    for (var option2 in defaults) {
      if (defaults.hasOwnProperty(option2) && !(option2 in plugin)) {
        plugin[option2] = defaults[option2];
      }
    }
    plugins.forEach(function(p) {
      if (p.pluginName === plugin.pluginName) {
        throw "Sortable: Cannot mount plugin ".concat(plugin.pluginName, " more than once");
      }
    });
    plugins.push(plugin);
  },
  pluginEvent: function pluginEvent(eventName, sortable, evt) {
    var _this = this;
    this.eventCanceled = false;
    evt.cancel = function() {
      _this.eventCanceled = true;
    };
    var eventNameGlobal = eventName + "Global";
    plugins.forEach(function(plugin) {
      if (!sortable[plugin.pluginName])
        return;
      if (sortable[plugin.pluginName][eventNameGlobal]) {
        sortable[plugin.pluginName][eventNameGlobal](_objectSpread2({
          sortable
        }, evt));
      }
      if (sortable.options[plugin.pluginName] && sortable[plugin.pluginName][eventName]) {
        sortable[plugin.pluginName][eventName](_objectSpread2({
          sortable
        }, evt));
      }
    });
  },
  initializePlugins: function initializePlugins(sortable, el, defaults2, options) {
    plugins.forEach(function(plugin) {
      var pluginName = plugin.pluginName;
      if (!sortable.options[pluginName] && !plugin.initializeByDefault)
        return;
      var initialized = new plugin(sortable, el, sortable.options);
      initialized.sortable = sortable;
      initialized.options = sortable.options;
      sortable[pluginName] = initialized;
      _extends(defaults2, initialized.defaults);
    });
    for (var option2 in sortable.options) {
      if (!sortable.options.hasOwnProperty(option2))
        continue;
      var modified = this.modifyOption(sortable, option2, sortable.options[option2]);
      if (typeof modified !== "undefined") {
        sortable.options[option2] = modified;
      }
    }
  },
  getEventProperties: function getEventProperties(name, sortable) {
    var eventProperties = {};
    plugins.forEach(function(plugin) {
      if (typeof plugin.eventProperties !== "function")
        return;
      _extends(eventProperties, plugin.eventProperties.call(sortable[plugin.pluginName], name));
    });
    return eventProperties;
  },
  modifyOption: function modifyOption(sortable, name, value) {
    var modifiedValue;
    plugins.forEach(function(plugin) {
      if (!sortable[plugin.pluginName])
        return;
      if (plugin.optionListeners && typeof plugin.optionListeners[name] === "function") {
        modifiedValue = plugin.optionListeners[name].call(sortable[plugin.pluginName], value);
      }
    });
    return modifiedValue;
  }
};
function dispatchEvent(_ref) {
  var sortable = _ref.sortable, rootEl2 = _ref.rootEl, name = _ref.name, targetEl = _ref.targetEl, cloneEl2 = _ref.cloneEl, toEl = _ref.toEl, fromEl = _ref.fromEl, oldIndex2 = _ref.oldIndex, newIndex2 = _ref.newIndex, oldDraggableIndex2 = _ref.oldDraggableIndex, newDraggableIndex2 = _ref.newDraggableIndex, originalEvent = _ref.originalEvent, putSortable2 = _ref.putSortable, extraEventProperties = _ref.extraEventProperties;
  sortable = sortable || rootEl2 && rootEl2[expando];
  if (!sortable)
    return;
  var evt, options = sortable.options, onName = "on" + name.charAt(0).toUpperCase() + name.substr(1);
  if (window.CustomEvent && !IE11OrLess && !Edge) {
    evt = new CustomEvent(name, {
      bubbles: true,
      cancelable: true
    });
  } else {
    evt = document.createEvent("Event");
    evt.initEvent(name, true, true);
  }
  evt.to = toEl || rootEl2;
  evt.from = fromEl || rootEl2;
  evt.item = targetEl || rootEl2;
  evt.clone = cloneEl2;
  evt.oldIndex = oldIndex2;
  evt.newIndex = newIndex2;
  evt.oldDraggableIndex = oldDraggableIndex2;
  evt.newDraggableIndex = newDraggableIndex2;
  evt.originalEvent = originalEvent;
  evt.pullMode = putSortable2 ? putSortable2.lastPutMode : void 0;
  var allEventProperties = _objectSpread2(_objectSpread2({}, extraEventProperties), PluginManager.getEventProperties(name, sortable));
  for (var option2 in allEventProperties) {
    evt[option2] = allEventProperties[option2];
  }
  if (rootEl2) {
    rootEl2.dispatchEvent(evt);
  }
  if (options[onName]) {
    options[onName].call(sortable, evt);
  }
}
var _excluded = ["evt"];
var pluginEvent2 = function pluginEvent3(eventName, sortable) {
  var _ref = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}, originalEvent = _ref.evt, data = _objectWithoutProperties(_ref, _excluded);
  PluginManager.pluginEvent.bind(Sortable)(eventName, sortable, _objectSpread2({
    dragEl,
    parentEl,
    ghostEl,
    rootEl,
    nextEl,
    lastDownEl,
    cloneEl,
    cloneHidden,
    dragStarted: moved,
    putSortable,
    activeSortable: Sortable.active,
    originalEvent,
    oldIndex,
    oldDraggableIndex,
    newIndex,
    newDraggableIndex,
    hideGhostForTarget: _hideGhostForTarget,
    unhideGhostForTarget: _unhideGhostForTarget,
    cloneNowHidden: function cloneNowHidden() {
      cloneHidden = true;
    },
    cloneNowShown: function cloneNowShown() {
      cloneHidden = false;
    },
    dispatchSortableEvent: function dispatchSortableEvent(name) {
      _dispatchEvent({
        sortable,
        name,
        originalEvent
      });
    }
  }, data));
};
function _dispatchEvent(info) {
  dispatchEvent(_objectSpread2({
    putSortable,
    cloneEl,
    targetEl: dragEl,
    rootEl,
    oldIndex,
    oldDraggableIndex,
    newIndex,
    newDraggableIndex
  }, info));
}
var dragEl;
var parentEl;
var ghostEl;
var rootEl;
var nextEl;
var lastDownEl;
var cloneEl;
var cloneHidden;
var oldIndex;
var newIndex;
var oldDraggableIndex;
var newDraggableIndex;
var activeGroup;
var putSortable;
var awaitingDragStarted = false;
var ignoreNextClick = false;
var sortables = [];
var tapEvt;
var touchEvt;
var lastDx;
var lastDy;
var tapDistanceLeft;
var tapDistanceTop;
var moved;
var lastTarget;
var lastDirection;
var pastFirstInvertThresh = false;
var isCircumstantialInvert = false;
var targetMoveDistance;
var ghostRelativeParent;
var ghostRelativeParentInitialScroll = [];
var _silent = false;
var savedInputChecked = [];
var documentExists = typeof document !== "undefined";
var PositionGhostAbsolutely = IOS;
var CSSFloatProperty = Edge || IE11OrLess ? "cssFloat" : "float";
var supportDraggable = documentExists && !ChromeForAndroid && !IOS && "draggable" in document.createElement("div");
var supportCssPointerEvents = function() {
  if (!documentExists)
    return;
  if (IE11OrLess) {
    return false;
  }
  var el = document.createElement("x");
  el.style.cssText = "pointer-events:auto";
  return el.style.pointerEvents === "auto";
}();
var _detectDirection = function _detectDirection2(el, options) {
  var elCSS = css(el), elWidth = parseInt(elCSS.width) - parseInt(elCSS.paddingLeft) - parseInt(elCSS.paddingRight) - parseInt(elCSS.borderLeftWidth) - parseInt(elCSS.borderRightWidth), child1 = getChild(el, 0, options), child2 = getChild(el, 1, options), firstChildCSS = child1 && css(child1), secondChildCSS = child2 && css(child2), firstChildWidth = firstChildCSS && parseInt(firstChildCSS.marginLeft) + parseInt(firstChildCSS.marginRight) + getRect(child1).width, secondChildWidth = secondChildCSS && parseInt(secondChildCSS.marginLeft) + parseInt(secondChildCSS.marginRight) + getRect(child2).width;
  if (elCSS.display === "flex") {
    return elCSS.flexDirection === "column" || elCSS.flexDirection === "column-reverse" ? "vertical" : "horizontal";
  }
  if (elCSS.display === "grid") {
    return elCSS.gridTemplateColumns.split(" ").length <= 1 ? "vertical" : "horizontal";
  }
  if (child1 && firstChildCSS["float"] && firstChildCSS["float"] !== "none") {
    var touchingSideChild2 = firstChildCSS["float"] === "left" ? "left" : "right";
    return child2 && (secondChildCSS.clear === "both" || secondChildCSS.clear === touchingSideChild2) ? "vertical" : "horizontal";
  }
  return child1 && (firstChildCSS.display === "block" || firstChildCSS.display === "flex" || firstChildCSS.display === "table" || firstChildCSS.display === "grid" || firstChildWidth >= elWidth && elCSS[CSSFloatProperty] === "none" || child2 && elCSS[CSSFloatProperty] === "none" && firstChildWidth + secondChildWidth > elWidth) ? "vertical" : "horizontal";
};
var _dragElInRowColumn = function _dragElInRowColumn2(dragRect, targetRect, vertical) {
  var dragElS1Opp = vertical ? dragRect.left : dragRect.top, dragElS2Opp = vertical ? dragRect.right : dragRect.bottom, dragElOppLength = vertical ? dragRect.width : dragRect.height, targetS1Opp = vertical ? targetRect.left : targetRect.top, targetS2Opp = vertical ? targetRect.right : targetRect.bottom, targetOppLength = vertical ? targetRect.width : targetRect.height;
  return dragElS1Opp === targetS1Opp || dragElS2Opp === targetS2Opp || dragElS1Opp + dragElOppLength / 2 === targetS1Opp + targetOppLength / 2;
};
var _detectNearestEmptySortable = function _detectNearestEmptySortable2(x, y) {
  var ret;
  sortables.some(function(sortable) {
    var threshold = sortable[expando].options.emptyInsertThreshold;
    if (!threshold || lastChild(sortable))
      return;
    var rect = getRect(sortable), insideHorizontally = x >= rect.left - threshold && x <= rect.right + threshold, insideVertically = y >= rect.top - threshold && y <= rect.bottom + threshold;
    if (insideHorizontally && insideVertically) {
      return ret = sortable;
    }
  });
  return ret;
};
var _prepareGroup = function _prepareGroup2(options) {
  function toFn(value, pull) {
    return function(to, from, dragEl2, evt) {
      var sameGroup = to.options.group.name && from.options.group.name && to.options.group.name === from.options.group.name;
      if (value == null && (pull || sameGroup)) {
        return true;
      } else if (value == null || value === false) {
        return false;
      } else if (pull && value === "clone") {
        return value;
      } else if (typeof value === "function") {
        return toFn(value(to, from, dragEl2, evt), pull)(to, from, dragEl2, evt);
      } else {
        var otherGroup = (pull ? to : from).options.group.name;
        return value === true || typeof value === "string" && value === otherGroup || value.join && value.indexOf(otherGroup) > -1;
      }
    };
  }
  var group = {};
  var originalGroup = options.group;
  if (!originalGroup || _typeof(originalGroup) != "object") {
    originalGroup = {
      name: originalGroup
    };
  }
  group.name = originalGroup.name;
  group.checkPull = toFn(originalGroup.pull, true);
  group.checkPut = toFn(originalGroup.put);
  group.revertClone = originalGroup.revertClone;
  options.group = group;
};
var _hideGhostForTarget = function _hideGhostForTarget2() {
  if (!supportCssPointerEvents && ghostEl) {
    css(ghostEl, "display", "none");
  }
};
var _unhideGhostForTarget = function _unhideGhostForTarget2() {
  if (!supportCssPointerEvents && ghostEl) {
    css(ghostEl, "display", "");
  }
};
if (documentExists && !ChromeForAndroid) {
  document.addEventListener("click", function(evt) {
    if (ignoreNextClick) {
      evt.preventDefault();
      evt.stopPropagation && evt.stopPropagation();
      evt.stopImmediatePropagation && evt.stopImmediatePropagation();
      ignoreNextClick = false;
      return false;
    }
  }, true);
}
var nearestEmptyInsertDetectEvent = function nearestEmptyInsertDetectEvent2(evt) {
  if (dragEl) {
    evt = evt.touches ? evt.touches[0] : evt;
    var nearest = _detectNearestEmptySortable(evt.clientX, evt.clientY);
    if (nearest) {
      var event = {};
      for (var i in evt) {
        if (evt.hasOwnProperty(i)) {
          event[i] = evt[i];
        }
      }
      event.target = event.rootEl = nearest;
      event.preventDefault = void 0;
      event.stopPropagation = void 0;
      nearest[expando]._onDragOver(event);
    }
  }
};
var _checkOutsideTargetEl = function _checkOutsideTargetEl2(evt) {
  if (dragEl) {
    dragEl.parentNode[expando]._isOutsideThisEl(evt.target);
  }
};
function Sortable(el, options) {
  if (!(el && el.nodeType && el.nodeType === 1)) {
    throw "Sortable: `el` must be an HTMLElement, not ".concat({}.toString.call(el));
  }
  this.el = el;
  this.options = options = _extends({}, options);
  el[expando] = this;
  var defaults2 = {
    group: null,
    sort: true,
    disabled: false,
    store: null,
    handle: null,
    draggable: /^[uo]l$/i.test(el.nodeName) ? ">li" : ">*",
    swapThreshold: 1,
    invertSwap: false,
    invertedSwapThreshold: null,
    removeCloneOnHide: true,
    direction: function direction() {
      return _detectDirection(el, this.options);
    },
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    ignore: "a, img",
    filter: null,
    preventOnFilter: true,
    animation: 0,
    easing: null,
    setData: function setData(dataTransfer, dragEl2) {
      dataTransfer.setData("Text", dragEl2.textContent);
    },
    dropBubble: false,
    dragoverBubble: false,
    dataIdAttr: "data-id",
    delay: 0,
    delayOnTouchOnly: false,
    touchStartThreshold: (Number.parseInt ? Number : window).parseInt(window.devicePixelRatio, 10) || 1,
    forceFallback: false,
    fallbackClass: "sortable-fallback",
    fallbackOnBody: false,
    fallbackTolerance: 0,
    fallbackOffset: {
      x: 0,
      y: 0
    },
    supportPointer: Sortable.supportPointer !== false && "PointerEvent" in window && (!Safari || IOS),
    emptyInsertThreshold: 5
  };
  PluginManager.initializePlugins(this, el, defaults2);
  for (var name in defaults2) {
    !(name in options) && (options[name] = defaults2[name]);
  }
  _prepareGroup(options);
  for (var fn in this) {
    if (fn.charAt(0) === "_" && typeof this[fn] === "function") {
      this[fn] = this[fn].bind(this);
    }
  }
  this.nativeDraggable = options.forceFallback ? false : supportDraggable;
  if (this.nativeDraggable) {
    this.options.touchStartThreshold = 1;
  }
  if (options.supportPointer) {
    on(el, "pointerdown", this._onTapStart);
  } else {
    on(el, "mousedown", this._onTapStart);
    on(el, "touchstart", this._onTapStart);
  }
  if (this.nativeDraggable) {
    on(el, "dragover", this);
    on(el, "dragenter", this);
  }
  sortables.push(this.el);
  options.store && options.store.get && this.sort(options.store.get(this) || []);
  _extends(this, AnimationStateManager());
}
Sortable.prototype = {
  constructor: Sortable,
  _isOutsideThisEl: function _isOutsideThisEl(target) {
    if (!this.el.contains(target) && target !== this.el) {
      lastTarget = null;
    }
  },
  _getDirection: function _getDirection(evt, target) {
    return typeof this.options.direction === "function" ? this.options.direction.call(this, evt, target, dragEl) : this.options.direction;
  },
  _onTapStart: function _onTapStart(evt) {
    if (!evt.cancelable)
      return;
    var _this = this, el = this.el, options = this.options, preventOnFilter = options.preventOnFilter, type = evt.type, touch = evt.touches && evt.touches[0] || evt.pointerType && evt.pointerType === "touch" && evt, target = (touch || evt).target, originalTarget = evt.target.shadowRoot && (evt.path && evt.path[0] || evt.composedPath && evt.composedPath()[0]) || target, filter = options.filter;
    _saveInputCheckedState(el);
    if (dragEl) {
      return;
    }
    if (/mousedown|pointerdown/.test(type) && evt.button !== 0 || options.disabled) {
      return;
    }
    if (originalTarget.isContentEditable) {
      return;
    }
    if (!this.nativeDraggable && Safari && target && target.tagName.toUpperCase() === "SELECT") {
      return;
    }
    target = closest(target, options.draggable, el, false);
    if (target && target.animated) {
      return;
    }
    if (lastDownEl === target) {
      return;
    }
    oldIndex = index(target);
    oldDraggableIndex = index(target, options.draggable);
    if (typeof filter === "function") {
      if (filter.call(this, evt, target, this)) {
        _dispatchEvent({
          sortable: _this,
          rootEl: originalTarget,
          name: "filter",
          targetEl: target,
          toEl: el,
          fromEl: el
        });
        pluginEvent2("filter", _this, {
          evt
        });
        preventOnFilter && evt.preventDefault();
        return;
      }
    } else if (filter) {
      filter = filter.split(",").some(function(criteria) {
        criteria = closest(originalTarget, criteria.trim(), el, false);
        if (criteria) {
          _dispatchEvent({
            sortable: _this,
            rootEl: criteria,
            name: "filter",
            targetEl: target,
            fromEl: el,
            toEl: el
          });
          pluginEvent2("filter", _this, {
            evt
          });
          return true;
        }
      });
      if (filter) {
        preventOnFilter && evt.preventDefault();
        return;
      }
    }
    if (options.handle && !closest(originalTarget, options.handle, el, false)) {
      return;
    }
    this._prepareDragStart(evt, touch, target);
  },
  _prepareDragStart: function _prepareDragStart(evt, touch, target) {
    var _this = this, el = _this.el, options = _this.options, ownerDocument = el.ownerDocument, dragStartFn;
    if (target && !dragEl && target.parentNode === el) {
      var dragRect = getRect(target);
      rootEl = el;
      dragEl = target;
      parentEl = dragEl.parentNode;
      nextEl = dragEl.nextSibling;
      lastDownEl = target;
      activeGroup = options.group;
      Sortable.dragged = dragEl;
      tapEvt = {
        target: dragEl,
        clientX: (touch || evt).clientX,
        clientY: (touch || evt).clientY
      };
      tapDistanceLeft = tapEvt.clientX - dragRect.left;
      tapDistanceTop = tapEvt.clientY - dragRect.top;
      this._lastX = (touch || evt).clientX;
      this._lastY = (touch || evt).clientY;
      dragEl.style["will-change"] = "all";
      dragStartFn = function dragStartFn2() {
        pluginEvent2("delayEnded", _this, {
          evt
        });
        if (Sortable.eventCanceled) {
          _this._onDrop();
          return;
        }
        _this._disableDelayedDragEvents();
        if (!FireFox && _this.nativeDraggable) {
          dragEl.draggable = true;
        }
        _this._triggerDragStart(evt, touch);
        _dispatchEvent({
          sortable: _this,
          name: "choose",
          originalEvent: evt
        });
        toggleClass(dragEl, options.chosenClass, true);
      };
      options.ignore.split(",").forEach(function(criteria) {
        find(dragEl, criteria.trim(), _disableDraggable);
      });
      on(ownerDocument, "dragover", nearestEmptyInsertDetectEvent);
      on(ownerDocument, "mousemove", nearestEmptyInsertDetectEvent);
      on(ownerDocument, "touchmove", nearestEmptyInsertDetectEvent);
      if (options.supportPointer) {
        on(ownerDocument, "pointerup", _this._onDrop);
        !this.nativeDraggable && on(ownerDocument, "pointercancel", _this._onDrop);
      } else {
        on(ownerDocument, "mouseup", _this._onDrop);
        on(ownerDocument, "touchend", _this._onDrop);
        on(ownerDocument, "touchcancel", _this._onDrop);
      }
      if (FireFox && this.nativeDraggable) {
        this.options.touchStartThreshold = 4;
        dragEl.draggable = true;
      }
      pluginEvent2("delayStart", this, {
        evt
      });
      if (options.delay && (!options.delayOnTouchOnly || touch) && (!this.nativeDraggable || !(Edge || IE11OrLess))) {
        if (Sortable.eventCanceled) {
          this._onDrop();
          return;
        }
        if (options.supportPointer) {
          on(ownerDocument, "pointerup", _this._disableDelayedDrag);
          on(ownerDocument, "pointercancel", _this._disableDelayedDrag);
        } else {
          on(ownerDocument, "mouseup", _this._disableDelayedDrag);
          on(ownerDocument, "touchend", _this._disableDelayedDrag);
          on(ownerDocument, "touchcancel", _this._disableDelayedDrag);
        }
        on(ownerDocument, "mousemove", _this._delayedDragTouchMoveHandler);
        on(ownerDocument, "touchmove", _this._delayedDragTouchMoveHandler);
        options.supportPointer && on(ownerDocument, "pointermove", _this._delayedDragTouchMoveHandler);
        _this._dragStartTimer = setTimeout(dragStartFn, options.delay);
      } else {
        dragStartFn();
      }
    }
  },
  _delayedDragTouchMoveHandler: function _delayedDragTouchMoveHandler(e) {
    var touch = e.touches ? e.touches[0] : e;
    if (Math.max(Math.abs(touch.clientX - this._lastX), Math.abs(touch.clientY - this._lastY)) >= Math.floor(this.options.touchStartThreshold / (this.nativeDraggable && window.devicePixelRatio || 1))) {
      this._disableDelayedDrag();
    }
  },
  _disableDelayedDrag: function _disableDelayedDrag() {
    dragEl && _disableDraggable(dragEl);
    clearTimeout(this._dragStartTimer);
    this._disableDelayedDragEvents();
  },
  _disableDelayedDragEvents: function _disableDelayedDragEvents() {
    var ownerDocument = this.el.ownerDocument;
    off(ownerDocument, "mouseup", this._disableDelayedDrag);
    off(ownerDocument, "touchend", this._disableDelayedDrag);
    off(ownerDocument, "touchcancel", this._disableDelayedDrag);
    off(ownerDocument, "pointerup", this._disableDelayedDrag);
    off(ownerDocument, "pointercancel", this._disableDelayedDrag);
    off(ownerDocument, "mousemove", this._delayedDragTouchMoveHandler);
    off(ownerDocument, "touchmove", this._delayedDragTouchMoveHandler);
    off(ownerDocument, "pointermove", this._delayedDragTouchMoveHandler);
  },
  _triggerDragStart: function _triggerDragStart(evt, touch) {
    touch = touch || evt.pointerType == "touch" && evt;
    if (!this.nativeDraggable || touch) {
      if (this.options.supportPointer) {
        on(document, "pointermove", this._onTouchMove);
      } else if (touch) {
        on(document, "touchmove", this._onTouchMove);
      } else {
        on(document, "mousemove", this._onTouchMove);
      }
    } else {
      on(dragEl, "dragend", this);
      on(rootEl, "dragstart", this._onDragStart);
    }
    try {
      if (document.selection) {
        _nextTick(function() {
          document.selection.empty();
        });
      } else {
        window.getSelection().removeAllRanges();
      }
    } catch (err) {
    }
  },
  _dragStarted: function _dragStarted(fallback, evt) {
    awaitingDragStarted = false;
    if (rootEl && dragEl) {
      pluginEvent2("dragStarted", this, {
        evt
      });
      if (this.nativeDraggable) {
        on(document, "dragover", _checkOutsideTargetEl);
      }
      var options = this.options;
      !fallback && toggleClass(dragEl, options.dragClass, false);
      toggleClass(dragEl, options.ghostClass, true);
      Sortable.active = this;
      fallback && this._appendGhost();
      _dispatchEvent({
        sortable: this,
        name: "start",
        originalEvent: evt
      });
    } else {
      this._nulling();
    }
  },
  _emulateDragOver: function _emulateDragOver() {
    if (touchEvt) {
      this._lastX = touchEvt.clientX;
      this._lastY = touchEvt.clientY;
      _hideGhostForTarget();
      var target = document.elementFromPoint(touchEvt.clientX, touchEvt.clientY);
      var parent = target;
      while (target && target.shadowRoot) {
        target = target.shadowRoot.elementFromPoint(touchEvt.clientX, touchEvt.clientY);
        if (target === parent)
          break;
        parent = target;
      }
      dragEl.parentNode[expando]._isOutsideThisEl(target);
      if (parent) {
        do {
          if (parent[expando]) {
            var inserted = void 0;
            inserted = parent[expando]._onDragOver({
              clientX: touchEvt.clientX,
              clientY: touchEvt.clientY,
              target,
              rootEl: parent
            });
            if (inserted && !this.options.dragoverBubble) {
              break;
            }
          }
          target = parent;
        } while (parent = getParentOrHost(parent));
      }
      _unhideGhostForTarget();
    }
  },
  _onTouchMove: function _onTouchMove(evt) {
    if (tapEvt) {
      var options = this.options, fallbackTolerance = options.fallbackTolerance, fallbackOffset = options.fallbackOffset, touch = evt.touches ? evt.touches[0] : evt, ghostMatrix = ghostEl && matrix(ghostEl, true), scaleX = ghostEl && ghostMatrix && ghostMatrix.a, scaleY = ghostEl && ghostMatrix && ghostMatrix.d, relativeScrollOffset = PositionGhostAbsolutely && ghostRelativeParent && getRelativeScrollOffset(ghostRelativeParent), dx = (touch.clientX - tapEvt.clientX + fallbackOffset.x) / (scaleX || 1) + (relativeScrollOffset ? relativeScrollOffset[0] - ghostRelativeParentInitialScroll[0] : 0) / (scaleX || 1), dy = (touch.clientY - tapEvt.clientY + fallbackOffset.y) / (scaleY || 1) + (relativeScrollOffset ? relativeScrollOffset[1] - ghostRelativeParentInitialScroll[1] : 0) / (scaleY || 1);
      if (!Sortable.active && !awaitingDragStarted) {
        if (fallbackTolerance && Math.max(Math.abs(touch.clientX - this._lastX), Math.abs(touch.clientY - this._lastY)) < fallbackTolerance) {
          return;
        }
        this._onDragStart(evt, true);
      }
      if (ghostEl) {
        if (ghostMatrix) {
          ghostMatrix.e += dx - (lastDx || 0);
          ghostMatrix.f += dy - (lastDy || 0);
        } else {
          ghostMatrix = {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: dx,
            f: dy
          };
        }
        var cssMatrix = "matrix(".concat(ghostMatrix.a, ",").concat(ghostMatrix.b, ",").concat(ghostMatrix.c, ",").concat(ghostMatrix.d, ",").concat(ghostMatrix.e, ",").concat(ghostMatrix.f, ")");
        css(ghostEl, "webkitTransform", cssMatrix);
        css(ghostEl, "mozTransform", cssMatrix);
        css(ghostEl, "msTransform", cssMatrix);
        css(ghostEl, "transform", cssMatrix);
        lastDx = dx;
        lastDy = dy;
        touchEvt = touch;
      }
      evt.cancelable && evt.preventDefault();
    }
  },
  _appendGhost: function _appendGhost() {
    if (!ghostEl) {
      var container = this.options.fallbackOnBody ? document.body : rootEl, rect = getRect(dragEl, true, PositionGhostAbsolutely, true, container), options = this.options;
      if (PositionGhostAbsolutely) {
        ghostRelativeParent = container;
        while (css(ghostRelativeParent, "position") === "static" && css(ghostRelativeParent, "transform") === "none" && ghostRelativeParent !== document) {
          ghostRelativeParent = ghostRelativeParent.parentNode;
        }
        if (ghostRelativeParent !== document.body && ghostRelativeParent !== document.documentElement) {
          if (ghostRelativeParent === document)
            ghostRelativeParent = getWindowScrollingElement();
          rect.top += ghostRelativeParent.scrollTop;
          rect.left += ghostRelativeParent.scrollLeft;
        } else {
          ghostRelativeParent = getWindowScrollingElement();
        }
        ghostRelativeParentInitialScroll = getRelativeScrollOffset(ghostRelativeParent);
      }
      ghostEl = dragEl.cloneNode(true);
      toggleClass(ghostEl, options.ghostClass, false);
      toggleClass(ghostEl, options.fallbackClass, true);
      toggleClass(ghostEl, options.dragClass, true);
      css(ghostEl, "transition", "");
      css(ghostEl, "transform", "");
      css(ghostEl, "box-sizing", "border-box");
      css(ghostEl, "margin", 0);
      css(ghostEl, "top", rect.top);
      css(ghostEl, "left", rect.left);
      css(ghostEl, "width", rect.width);
      css(ghostEl, "height", rect.height);
      css(ghostEl, "opacity", "0.8");
      css(ghostEl, "position", PositionGhostAbsolutely ? "absolute" : "fixed");
      css(ghostEl, "zIndex", "100000");
      css(ghostEl, "pointerEvents", "none");
      Sortable.ghost = ghostEl;
      container.appendChild(ghostEl);
      css(ghostEl, "transform-origin", tapDistanceLeft / parseInt(ghostEl.style.width) * 100 + "% " + tapDistanceTop / parseInt(ghostEl.style.height) * 100 + "%");
    }
  },
  _onDragStart: function _onDragStart(evt, fallback) {
    var _this = this;
    var dataTransfer = evt.dataTransfer;
    var options = _this.options;
    pluginEvent2("dragStart", this, {
      evt
    });
    if (Sortable.eventCanceled) {
      this._onDrop();
      return;
    }
    pluginEvent2("setupClone", this);
    if (!Sortable.eventCanceled) {
      cloneEl = clone(dragEl);
      cloneEl.removeAttribute("id");
      cloneEl.draggable = false;
      cloneEl.style["will-change"] = "";
      this._hideClone();
      toggleClass(cloneEl, this.options.chosenClass, false);
      Sortable.clone = cloneEl;
    }
    _this.cloneId = _nextTick(function() {
      pluginEvent2("clone", _this);
      if (Sortable.eventCanceled)
        return;
      if (!_this.options.removeCloneOnHide) {
        rootEl.insertBefore(cloneEl, dragEl);
      }
      _this._hideClone();
      _dispatchEvent({
        sortable: _this,
        name: "clone"
      });
    });
    !fallback && toggleClass(dragEl, options.dragClass, true);
    if (fallback) {
      ignoreNextClick = true;
      _this._loopId = setInterval(_this._emulateDragOver, 50);
    } else {
      off(document, "mouseup", _this._onDrop);
      off(document, "touchend", _this._onDrop);
      off(document, "touchcancel", _this._onDrop);
      if (dataTransfer) {
        dataTransfer.effectAllowed = "move";
        options.setData && options.setData.call(_this, dataTransfer, dragEl);
      }
      on(document, "drop", _this);
      css(dragEl, "transform", "translateZ(0)");
    }
    awaitingDragStarted = true;
    _this._dragStartId = _nextTick(_this._dragStarted.bind(_this, fallback, evt));
    on(document, "selectstart", _this);
    moved = true;
    window.getSelection().removeAllRanges();
    if (Safari) {
      css(document.body, "user-select", "none");
    }
  },
  _onDragOver: function _onDragOver(evt) {
    var el = this.el, target = evt.target, dragRect, targetRect, revert, options = this.options, group = options.group, activeSortable = Sortable.active, isOwner = activeGroup === group, canSort = options.sort, fromSortable = putSortable || activeSortable, vertical, _this = this, completedFired = false;
    if (_silent)
      return;
    function dragOverEvent(name, extra) {
      pluginEvent2(name, _this, _objectSpread2({
        evt,
        isOwner,
        axis: vertical ? "vertical" : "horizontal",
        revert,
        dragRect,
        targetRect,
        canSort,
        fromSortable,
        target,
        completed,
        onMove: function onMove(target2, after2) {
          return _onMove(rootEl, el, dragEl, dragRect, target2, getRect(target2), evt, after2);
        },
        changed
      }, extra));
    }
    function capture() {
      dragOverEvent("dragOverAnimationCapture");
      _this.captureAnimationState();
      if (_this !== fromSortable) {
        fromSortable.captureAnimationState();
      }
    }
    function completed(insertion) {
      dragOverEvent("dragOverCompleted", {
        insertion
      });
      if (insertion) {
        if (isOwner) {
          activeSortable._hideClone();
        } else {
          activeSortable._showClone(_this);
        }
        if (_this !== fromSortable) {
          toggleClass(dragEl, putSortable ? putSortable.options.ghostClass : activeSortable.options.ghostClass, false);
          toggleClass(dragEl, options.ghostClass, true);
        }
        if (putSortable !== _this && _this !== Sortable.active) {
          putSortable = _this;
        } else if (_this === Sortable.active && putSortable) {
          putSortable = null;
        }
        if (fromSortable === _this) {
          _this._ignoreWhileAnimating = target;
        }
        _this.animateAll(function() {
          dragOverEvent("dragOverAnimationComplete");
          _this._ignoreWhileAnimating = null;
        });
        if (_this !== fromSortable) {
          fromSortable.animateAll();
          fromSortable._ignoreWhileAnimating = null;
        }
      }
      if (target === dragEl && !dragEl.animated || target === el && !target.animated) {
        lastTarget = null;
      }
      if (!options.dragoverBubble && !evt.rootEl && target !== document) {
        dragEl.parentNode[expando]._isOutsideThisEl(evt.target);
        !insertion && nearestEmptyInsertDetectEvent(evt);
      }
      !options.dragoverBubble && evt.stopPropagation && evt.stopPropagation();
      return completedFired = true;
    }
    function changed() {
      newIndex = index(dragEl);
      newDraggableIndex = index(dragEl, options.draggable);
      _dispatchEvent({
        sortable: _this,
        name: "change",
        toEl: el,
        newIndex,
        newDraggableIndex,
        originalEvent: evt
      });
    }
    if (evt.preventDefault !== void 0) {
      evt.cancelable && evt.preventDefault();
    }
    target = closest(target, options.draggable, el, true);
    dragOverEvent("dragOver");
    if (Sortable.eventCanceled)
      return completedFired;
    if (dragEl.contains(evt.target) || target.animated && target.animatingX && target.animatingY || _this._ignoreWhileAnimating === target) {
      return completed(false);
    }
    ignoreNextClick = false;
    if (activeSortable && !options.disabled && (isOwner ? canSort || (revert = parentEl !== rootEl) : putSortable === this || (this.lastPutMode = activeGroup.checkPull(this, activeSortable, dragEl, evt)) && group.checkPut(this, activeSortable, dragEl, evt))) {
      vertical = this._getDirection(evt, target) === "vertical";
      dragRect = getRect(dragEl);
      dragOverEvent("dragOverValid");
      if (Sortable.eventCanceled)
        return completedFired;
      if (revert) {
        parentEl = rootEl;
        capture();
        this._hideClone();
        dragOverEvent("revert");
        if (!Sortable.eventCanceled) {
          if (nextEl) {
            rootEl.insertBefore(dragEl, nextEl);
          } else {
            rootEl.appendChild(dragEl);
          }
        }
        return completed(true);
      }
      var elLastChild = lastChild(el, options.draggable);
      if (!elLastChild || _ghostIsLast(evt, vertical, this) && !elLastChild.animated) {
        if (elLastChild === dragEl) {
          return completed(false);
        }
        if (elLastChild && el === evt.target) {
          target = elLastChild;
        }
        if (target) {
          targetRect = getRect(target);
        }
        if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, !!target) !== false) {
          capture();
          if (elLastChild && elLastChild.nextSibling) {
            el.insertBefore(dragEl, elLastChild.nextSibling);
          } else {
            el.appendChild(dragEl);
          }
          parentEl = el;
          changed();
          return completed(true);
        }
      } else if (elLastChild && _ghostIsFirst(evt, vertical, this)) {
        var firstChild = getChild(el, 0, options, true);
        if (firstChild === dragEl) {
          return completed(false);
        }
        target = firstChild;
        targetRect = getRect(target);
        if (_onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, false) !== false) {
          capture();
          el.insertBefore(dragEl, firstChild);
          parentEl = el;
          changed();
          return completed(true);
        }
      } else if (target.parentNode === el) {
        targetRect = getRect(target);
        var direction = 0, targetBeforeFirstSwap, differentLevel = dragEl.parentNode !== el, differentRowCol = !_dragElInRowColumn(dragEl.animated && dragEl.toRect || dragRect, target.animated && target.toRect || targetRect, vertical), side1 = vertical ? "top" : "left", scrolledPastTop = isScrolledPast(target, "top", "top") || isScrolledPast(dragEl, "top", "top"), scrollBefore = scrolledPastTop ? scrolledPastTop.scrollTop : void 0;
        if (lastTarget !== target) {
          targetBeforeFirstSwap = targetRect[side1];
          pastFirstInvertThresh = false;
          isCircumstantialInvert = !differentRowCol && options.invertSwap || differentLevel;
        }
        direction = _getSwapDirection(evt, target, targetRect, vertical, differentRowCol ? 1 : options.swapThreshold, options.invertedSwapThreshold == null ? options.swapThreshold : options.invertedSwapThreshold, isCircumstantialInvert, lastTarget === target);
        var sibling;
        if (direction !== 0) {
          var dragIndex = index(dragEl);
          do {
            dragIndex -= direction;
            sibling = parentEl.children[dragIndex];
          } while (sibling && (css(sibling, "display") === "none" || sibling === ghostEl));
        }
        if (direction === 0 || sibling === target) {
          return completed(false);
        }
        lastTarget = target;
        lastDirection = direction;
        var nextSibling = target.nextElementSibling, after = false;
        after = direction === 1;
        var moveVector = _onMove(rootEl, el, dragEl, dragRect, target, targetRect, evt, after);
        if (moveVector !== false) {
          if (moveVector === 1 || moveVector === -1) {
            after = moveVector === 1;
          }
          _silent = true;
          setTimeout(_unsilent, 30);
          capture();
          if (after && !nextSibling) {
            el.appendChild(dragEl);
          } else {
            target.parentNode.insertBefore(dragEl, after ? nextSibling : target);
          }
          if (scrolledPastTop) {
            scrollBy(scrolledPastTop, 0, scrollBefore - scrolledPastTop.scrollTop);
          }
          parentEl = dragEl.parentNode;
          if (targetBeforeFirstSwap !== void 0 && !isCircumstantialInvert) {
            targetMoveDistance = Math.abs(targetBeforeFirstSwap - getRect(target)[side1]);
          }
          changed();
          return completed(true);
        }
      }
      if (el.contains(dragEl)) {
        return completed(false);
      }
    }
    return false;
  },
  _ignoreWhileAnimating: null,
  _offMoveEvents: function _offMoveEvents() {
    off(document, "mousemove", this._onTouchMove);
    off(document, "touchmove", this._onTouchMove);
    off(document, "pointermove", this._onTouchMove);
    off(document, "dragover", nearestEmptyInsertDetectEvent);
    off(document, "mousemove", nearestEmptyInsertDetectEvent);
    off(document, "touchmove", nearestEmptyInsertDetectEvent);
  },
  _offUpEvents: function _offUpEvents() {
    var ownerDocument = this.el.ownerDocument;
    off(ownerDocument, "mouseup", this._onDrop);
    off(ownerDocument, "touchend", this._onDrop);
    off(ownerDocument, "pointerup", this._onDrop);
    off(ownerDocument, "pointercancel", this._onDrop);
    off(ownerDocument, "touchcancel", this._onDrop);
    off(document, "selectstart", this);
  },
  _onDrop: function _onDrop(evt) {
    var el = this.el, options = this.options;
    newIndex = index(dragEl);
    newDraggableIndex = index(dragEl, options.draggable);
    pluginEvent2("drop", this, {
      evt
    });
    parentEl = dragEl && dragEl.parentNode;
    newIndex = index(dragEl);
    newDraggableIndex = index(dragEl, options.draggable);
    if (Sortable.eventCanceled) {
      this._nulling();
      return;
    }
    awaitingDragStarted = false;
    isCircumstantialInvert = false;
    pastFirstInvertThresh = false;
    clearInterval(this._loopId);
    clearTimeout(this._dragStartTimer);
    _cancelNextTick(this.cloneId);
    _cancelNextTick(this._dragStartId);
    if (this.nativeDraggable) {
      off(document, "drop", this);
      off(el, "dragstart", this._onDragStart);
    }
    this._offMoveEvents();
    this._offUpEvents();
    if (Safari) {
      css(document.body, "user-select", "");
    }
    css(dragEl, "transform", "");
    if (evt) {
      if (moved) {
        evt.cancelable && evt.preventDefault();
        !options.dropBubble && evt.stopPropagation();
      }
      ghostEl && ghostEl.parentNode && ghostEl.parentNode.removeChild(ghostEl);
      if (rootEl === parentEl || putSortable && putSortable.lastPutMode !== "clone") {
        cloneEl && cloneEl.parentNode && cloneEl.parentNode.removeChild(cloneEl);
      }
      if (dragEl) {
        if (this.nativeDraggable) {
          off(dragEl, "dragend", this);
        }
        _disableDraggable(dragEl);
        dragEl.style["will-change"] = "";
        if (moved && !awaitingDragStarted) {
          toggleClass(dragEl, putSortable ? putSortable.options.ghostClass : this.options.ghostClass, false);
        }
        toggleClass(dragEl, this.options.chosenClass, false);
        _dispatchEvent({
          sortable: this,
          name: "unchoose",
          toEl: parentEl,
          newIndex: null,
          newDraggableIndex: null,
          originalEvent: evt
        });
        if (rootEl !== parentEl) {
          if (newIndex >= 0) {
            _dispatchEvent({
              rootEl: parentEl,
              name: "add",
              toEl: parentEl,
              fromEl: rootEl,
              originalEvent: evt
            });
            _dispatchEvent({
              sortable: this,
              name: "remove",
              toEl: parentEl,
              originalEvent: evt
            });
            _dispatchEvent({
              rootEl: parentEl,
              name: "sort",
              toEl: parentEl,
              fromEl: rootEl,
              originalEvent: evt
            });
            _dispatchEvent({
              sortable: this,
              name: "sort",
              toEl: parentEl,
              originalEvent: evt
            });
          }
          putSortable && putSortable.save();
        } else {
          if (newIndex !== oldIndex) {
            if (newIndex >= 0) {
              _dispatchEvent({
                sortable: this,
                name: "update",
                toEl: parentEl,
                originalEvent: evt
              });
              _dispatchEvent({
                sortable: this,
                name: "sort",
                toEl: parentEl,
                originalEvent: evt
              });
            }
          }
        }
        if (Sortable.active) {
          if (newIndex == null || newIndex === -1) {
            newIndex = oldIndex;
            newDraggableIndex = oldDraggableIndex;
          }
          _dispatchEvent({
            sortable: this,
            name: "end",
            toEl: parentEl,
            originalEvent: evt
          });
          this.save();
        }
      }
    }
    this._nulling();
  },
  _nulling: function _nulling() {
    pluginEvent2("nulling", this);
    rootEl = dragEl = parentEl = ghostEl = nextEl = cloneEl = lastDownEl = cloneHidden = tapEvt = touchEvt = moved = newIndex = newDraggableIndex = oldIndex = oldDraggableIndex = lastTarget = lastDirection = putSortable = activeGroup = Sortable.dragged = Sortable.ghost = Sortable.clone = Sortable.active = null;
    var el = this.el;
    savedInputChecked.forEach(function(checkEl) {
      if (el.contains(checkEl)) {
        checkEl.checked = true;
      }
    });
    savedInputChecked.length = lastDx = lastDy = 0;
  },
  handleEvent: function handleEvent(evt) {
    switch (evt.type) {
      case "drop":
      case "dragend":
        this._onDrop(evt);
        break;
      case "dragenter":
      case "dragover":
        if (dragEl) {
          this._onDragOver(evt);
          _globalDragOver(evt);
        }
        break;
      case "selectstart":
        evt.preventDefault();
        break;
    }
  },
  toArray: function toArray() {
    var order = [], el, children = this.el.children, i = 0, n = children.length, options = this.options;
    for (; i < n; i++) {
      el = children[i];
      if (closest(el, options.draggable, this.el, false)) {
        order.push(el.getAttribute(options.dataIdAttr) || _generateId(el));
      }
    }
    return order;
  },
  sort: function sort(order, useAnimation) {
    var items = {}, rootEl2 = this.el;
    this.toArray().forEach(function(id, i) {
      var el = rootEl2.children[i];
      if (closest(el, this.options.draggable, rootEl2, false)) {
        items[id] = el;
      }
    }, this);
    useAnimation && this.captureAnimationState();
    order.forEach(function(id) {
      if (items[id]) {
        rootEl2.removeChild(items[id]);
        rootEl2.appendChild(items[id]);
      }
    });
    useAnimation && this.animateAll();
  },
  save: function save() {
    var store = this.options.store;
    store && store.set && store.set(this);
  },
  closest: function closest$1(el, selector) {
    return closest(el, selector || this.options.draggable, this.el, false);
  },
  option: function option(name, value) {
    var options = this.options;
    if (value === void 0) {
      return options[name];
    } else {
      var modifiedValue = PluginManager.modifyOption(this, name, value);
      if (typeof modifiedValue !== "undefined") {
        options[name] = modifiedValue;
      } else {
        options[name] = value;
      }
      if (name === "group") {
        _prepareGroup(options);
      }
    }
  },
  destroy: function destroy() {
    pluginEvent2("destroy", this);
    var el = this.el;
    el[expando] = null;
    off(el, "mousedown", this._onTapStart);
    off(el, "touchstart", this._onTapStart);
    off(el, "pointerdown", this._onTapStart);
    if (this.nativeDraggable) {
      off(el, "dragover", this);
      off(el, "dragenter", this);
    }
    Array.prototype.forEach.call(el.querySelectorAll("[draggable]"), function(el2) {
      el2.removeAttribute("draggable");
    });
    this._onDrop();
    this._disableDelayedDragEvents();
    sortables.splice(sortables.indexOf(this.el), 1);
    this.el = el = null;
  },
  _hideClone: function _hideClone() {
    if (!cloneHidden) {
      pluginEvent2("hideClone", this);
      if (Sortable.eventCanceled)
        return;
      css(cloneEl, "display", "none");
      if (this.options.removeCloneOnHide && cloneEl.parentNode) {
        cloneEl.parentNode.removeChild(cloneEl);
      }
      cloneHidden = true;
    }
  },
  _showClone: function _showClone(putSortable2) {
    if (putSortable2.lastPutMode !== "clone") {
      this._hideClone();
      return;
    }
    if (cloneHidden) {
      pluginEvent2("showClone", this);
      if (Sortable.eventCanceled)
        return;
      if (dragEl.parentNode == rootEl && !this.options.group.revertClone) {
        rootEl.insertBefore(cloneEl, dragEl);
      } else if (nextEl) {
        rootEl.insertBefore(cloneEl, nextEl);
      } else {
        rootEl.appendChild(cloneEl);
      }
      if (this.options.group.revertClone) {
        this.animate(dragEl, cloneEl);
      }
      css(cloneEl, "display", "");
      cloneHidden = false;
    }
  }
};
function _globalDragOver(evt) {
  if (evt.dataTransfer) {
    evt.dataTransfer.dropEffect = "move";
  }
  evt.cancelable && evt.preventDefault();
}
function _onMove(fromEl, toEl, dragEl2, dragRect, targetEl, targetRect, originalEvent, willInsertAfter) {
  var evt, sortable = fromEl[expando], onMoveFn = sortable.options.onMove, retVal;
  if (window.CustomEvent && !IE11OrLess && !Edge) {
    evt = new CustomEvent("move", {
      bubbles: true,
      cancelable: true
    });
  } else {
    evt = document.createEvent("Event");
    evt.initEvent("move", true, true);
  }
  evt.to = toEl;
  evt.from = fromEl;
  evt.dragged = dragEl2;
  evt.draggedRect = dragRect;
  evt.related = targetEl || toEl;
  evt.relatedRect = targetRect || getRect(toEl);
  evt.willInsertAfter = willInsertAfter;
  evt.originalEvent = originalEvent;
  fromEl.dispatchEvent(evt);
  if (onMoveFn) {
    retVal = onMoveFn.call(sortable, evt, originalEvent);
  }
  return retVal;
}
function _disableDraggable(el) {
  el.draggable = false;
}
function _unsilent() {
  _silent = false;
}
function _ghostIsFirst(evt, vertical, sortable) {
  var firstElRect = getRect(getChild(sortable.el, 0, sortable.options, true));
  var childContainingRect = getChildContainingRectFromElement(sortable.el, sortable.options, ghostEl);
  var spacer = 10;
  return vertical ? evt.clientX < childContainingRect.left - spacer || evt.clientY < firstElRect.top && evt.clientX < firstElRect.right : evt.clientY < childContainingRect.top - spacer || evt.clientY < firstElRect.bottom && evt.clientX < firstElRect.left;
}
function _ghostIsLast(evt, vertical, sortable) {
  var lastElRect = getRect(lastChild(sortable.el, sortable.options.draggable));
  var childContainingRect = getChildContainingRectFromElement(sortable.el, sortable.options, ghostEl);
  var spacer = 10;
  return vertical ? evt.clientX > childContainingRect.right + spacer || evt.clientY > lastElRect.bottom && evt.clientX > lastElRect.left : evt.clientY > childContainingRect.bottom + spacer || evt.clientX > lastElRect.right && evt.clientY > lastElRect.top;
}
function _getSwapDirection(evt, target, targetRect, vertical, swapThreshold, invertedSwapThreshold, invertSwap, isLastTarget) {
  var mouseOnAxis = vertical ? evt.clientY : evt.clientX, targetLength = vertical ? targetRect.height : targetRect.width, targetS1 = vertical ? targetRect.top : targetRect.left, targetS2 = vertical ? targetRect.bottom : targetRect.right, invert = false;
  if (!invertSwap) {
    if (isLastTarget && targetMoveDistance < targetLength * swapThreshold) {
      if (!pastFirstInvertThresh && (lastDirection === 1 ? mouseOnAxis > targetS1 + targetLength * invertedSwapThreshold / 2 : mouseOnAxis < targetS2 - targetLength * invertedSwapThreshold / 2)) {
        pastFirstInvertThresh = true;
      }
      if (!pastFirstInvertThresh) {
        if (lastDirection === 1 ? mouseOnAxis < targetS1 + targetMoveDistance : mouseOnAxis > targetS2 - targetMoveDistance) {
          return -lastDirection;
        }
      } else {
        invert = true;
      }
    } else {
      if (mouseOnAxis > targetS1 + targetLength * (1 - swapThreshold) / 2 && mouseOnAxis < targetS2 - targetLength * (1 - swapThreshold) / 2) {
        return _getInsertDirection(target);
      }
    }
  }
  invert = invert || invertSwap;
  if (invert) {
    if (mouseOnAxis < targetS1 + targetLength * invertedSwapThreshold / 2 || mouseOnAxis > targetS2 - targetLength * invertedSwapThreshold / 2) {
      return mouseOnAxis > targetS1 + targetLength / 2 ? 1 : -1;
    }
  }
  return 0;
}
function _getInsertDirection(target) {
  if (index(dragEl) < index(target)) {
    return 1;
  } else {
    return -1;
  }
}
function _generateId(el) {
  var str = el.tagName + el.className + el.src + el.href + el.textContent, i = str.length, sum = 0;
  while (i--) {
    sum += str.charCodeAt(i);
  }
  return sum.toString(36);
}
function _saveInputCheckedState(root) {
  savedInputChecked.length = 0;
  var inputs = root.getElementsByTagName("input");
  var idx = inputs.length;
  while (idx--) {
    var el = inputs[idx];
    el.checked && savedInputChecked.push(el);
  }
}
function _nextTick(fn) {
  return setTimeout(fn, 0);
}
function _cancelNextTick(id) {
  return clearTimeout(id);
}
if (documentExists) {
  on(document, "touchmove", function(evt) {
    if ((Sortable.active || awaitingDragStarted) && evt.cancelable) {
      evt.preventDefault();
    }
  });
}
Sortable.utils = {
  on,
  off,
  css,
  find,
  is: function is(el, selector) {
    return !!closest(el, selector, el, false);
  },
  extend,
  throttle,
  closest,
  toggleClass,
  clone,
  index,
  nextTick: _nextTick,
  cancelNextTick: _cancelNextTick,
  detectDirection: _detectDirection,
  getChild,
  expando
};
Sortable.get = function(element) {
  return element[expando];
};
Sortable.mount = function() {
  for (var _len = arguments.length, plugins2 = new Array(_len), _key = 0; _key < _len; _key++) {
    plugins2[_key] = arguments[_key];
  }
  if (plugins2[0].constructor === Array)
    plugins2 = plugins2[0];
  plugins2.forEach(function(plugin) {
    if (!plugin.prototype || !plugin.prototype.constructor) {
      throw "Sortable: Mounted plugin must be a constructor function, not ".concat({}.toString.call(plugin));
    }
    if (plugin.utils)
      Sortable.utils = _objectSpread2(_objectSpread2({}, Sortable.utils), plugin.utils);
    PluginManager.mount(plugin);
  });
};
Sortable.create = function(el, options) {
  return new Sortable(el, options);
};
Sortable.version = version;
var autoScrolls = [];
var scrollEl;
var scrollRootEl;
var scrolling = false;
var lastAutoScrollX;
var lastAutoScrollY;
var touchEvt$1;
var pointerElemChangedInterval;
function AutoScrollPlugin() {
  function AutoScroll() {
    this.defaults = {
      scroll: true,
      forceAutoScrollFallback: false,
      scrollSensitivity: 30,
      scrollSpeed: 10,
      bubbleScroll: true
    };
    for (var fn in this) {
      if (fn.charAt(0) === "_" && typeof this[fn] === "function") {
        this[fn] = this[fn].bind(this);
      }
    }
  }
  AutoScroll.prototype = {
    dragStarted: function dragStarted(_ref) {
      var originalEvent = _ref.originalEvent;
      if (this.sortable.nativeDraggable) {
        on(document, "dragover", this._handleAutoScroll);
      } else {
        if (this.options.supportPointer) {
          on(document, "pointermove", this._handleFallbackAutoScroll);
        } else if (originalEvent.touches) {
          on(document, "touchmove", this._handleFallbackAutoScroll);
        } else {
          on(document, "mousemove", this._handleFallbackAutoScroll);
        }
      }
    },
    dragOverCompleted: function dragOverCompleted(_ref2) {
      var originalEvent = _ref2.originalEvent;
      if (!this.options.dragOverBubble && !originalEvent.rootEl) {
        this._handleAutoScroll(originalEvent);
      }
    },
    drop: function drop3() {
      if (this.sortable.nativeDraggable) {
        off(document, "dragover", this._handleAutoScroll);
      } else {
        off(document, "pointermove", this._handleFallbackAutoScroll);
        off(document, "touchmove", this._handleFallbackAutoScroll);
        off(document, "mousemove", this._handleFallbackAutoScroll);
      }
      clearPointerElemChangedInterval();
      clearAutoScrolls();
      cancelThrottle();
    },
    nulling: function nulling() {
      touchEvt$1 = scrollRootEl = scrollEl = scrolling = pointerElemChangedInterval = lastAutoScrollX = lastAutoScrollY = null;
      autoScrolls.length = 0;
    },
    _handleFallbackAutoScroll: function _handleFallbackAutoScroll(evt) {
      this._handleAutoScroll(evt, true);
    },
    _handleAutoScroll: function _handleAutoScroll(evt, fallback) {
      var _this = this;
      var x = (evt.touches ? evt.touches[0] : evt).clientX, y = (evt.touches ? evt.touches[0] : evt).clientY, elem = document.elementFromPoint(x, y);
      touchEvt$1 = evt;
      if (fallback || this.options.forceAutoScrollFallback || Edge || IE11OrLess || Safari) {
        autoScroll(evt, this.options, elem, fallback);
        var ogElemScroller = getParentAutoScrollElement(elem, true);
        if (scrolling && (!pointerElemChangedInterval || x !== lastAutoScrollX || y !== lastAutoScrollY)) {
          pointerElemChangedInterval && clearPointerElemChangedInterval();
          pointerElemChangedInterval = setInterval(function() {
            var newElem = getParentAutoScrollElement(document.elementFromPoint(x, y), true);
            if (newElem !== ogElemScroller) {
              ogElemScroller = newElem;
              clearAutoScrolls();
            }
            autoScroll(evt, _this.options, newElem, fallback);
          }, 10);
          lastAutoScrollX = x;
          lastAutoScrollY = y;
        }
      } else {
        if (!this.options.bubbleScroll || getParentAutoScrollElement(elem, true) === getWindowScrollingElement()) {
          clearAutoScrolls();
          return;
        }
        autoScroll(evt, this.options, getParentAutoScrollElement(elem, false), false);
      }
    }
  };
  return _extends(AutoScroll, {
    pluginName: "scroll",
    initializeByDefault: true
  });
}
function clearAutoScrolls() {
  autoScrolls.forEach(function(autoScroll2) {
    clearInterval(autoScroll2.pid);
  });
  autoScrolls = [];
}
function clearPointerElemChangedInterval() {
  clearInterval(pointerElemChangedInterval);
}
var autoScroll = throttle(function(evt, options, rootEl2, isFallback) {
  if (!options.scroll)
    return;
  var x = (evt.touches ? evt.touches[0] : evt).clientX, y = (evt.touches ? evt.touches[0] : evt).clientY, sens = options.scrollSensitivity, speed = options.scrollSpeed, winScroller = getWindowScrollingElement();
  var scrollThisInstance = false, scrollCustomFn;
  if (scrollRootEl !== rootEl2) {
    scrollRootEl = rootEl2;
    clearAutoScrolls();
    scrollEl = options.scroll;
    scrollCustomFn = options.scrollFn;
    if (scrollEl === true) {
      scrollEl = getParentAutoScrollElement(rootEl2, true);
    }
  }
  var layersOut = 0;
  var currentParent = scrollEl;
  do {
    var el = currentParent, rect = getRect(el), top = rect.top, bottom = rect.bottom, left = rect.left, right = rect.right, width = rect.width, height = rect.height, canScrollX = void 0, canScrollY = void 0, scrollWidth = el.scrollWidth, scrollHeight = el.scrollHeight, elCSS = css(el), scrollPosX = el.scrollLeft, scrollPosY = el.scrollTop;
    if (el === winScroller) {
      canScrollX = width < scrollWidth && (elCSS.overflowX === "auto" || elCSS.overflowX === "scroll" || elCSS.overflowX === "visible");
      canScrollY = height < scrollHeight && (elCSS.overflowY === "auto" || elCSS.overflowY === "scroll" || elCSS.overflowY === "visible");
    } else {
      canScrollX = width < scrollWidth && (elCSS.overflowX === "auto" || elCSS.overflowX === "scroll");
      canScrollY = height < scrollHeight && (elCSS.overflowY === "auto" || elCSS.overflowY === "scroll");
    }
    var vx = canScrollX && (Math.abs(right - x) <= sens && scrollPosX + width < scrollWidth) - (Math.abs(left - x) <= sens && !!scrollPosX);
    var vy = canScrollY && (Math.abs(bottom - y) <= sens && scrollPosY + height < scrollHeight) - (Math.abs(top - y) <= sens && !!scrollPosY);
    if (!autoScrolls[layersOut]) {
      for (var i = 0; i <= layersOut; i++) {
        if (!autoScrolls[i]) {
          autoScrolls[i] = {};
        }
      }
    }
    if (autoScrolls[layersOut].vx != vx || autoScrolls[layersOut].vy != vy || autoScrolls[layersOut].el !== el) {
      autoScrolls[layersOut].el = el;
      autoScrolls[layersOut].vx = vx;
      autoScrolls[layersOut].vy = vy;
      clearInterval(autoScrolls[layersOut].pid);
      if (vx != 0 || vy != 0) {
        scrollThisInstance = true;
        autoScrolls[layersOut].pid = setInterval(function() {
          if (isFallback && this.layer === 0) {
            Sortable.active._onTouchMove(touchEvt$1);
          }
          var scrollOffsetY = autoScrolls[this.layer].vy ? autoScrolls[this.layer].vy * speed : 0;
          var scrollOffsetX = autoScrolls[this.layer].vx ? autoScrolls[this.layer].vx * speed : 0;
          if (typeof scrollCustomFn === "function") {
            if (scrollCustomFn.call(Sortable.dragged.parentNode[expando], scrollOffsetX, scrollOffsetY, evt, touchEvt$1, autoScrolls[this.layer].el) !== "continue") {
              return;
            }
          }
          scrollBy(autoScrolls[this.layer].el, scrollOffsetX, scrollOffsetY);
        }.bind({
          layer: layersOut
        }), 24);
      }
    }
    layersOut++;
  } while (options.bubbleScroll && currentParent !== winScroller && (currentParent = getParentAutoScrollElement(currentParent, false)));
  scrolling = scrollThisInstance;
}, 30);
var drop = function drop2(_ref) {
  var originalEvent = _ref.originalEvent, putSortable2 = _ref.putSortable, dragEl2 = _ref.dragEl, activeSortable = _ref.activeSortable, dispatchSortableEvent = _ref.dispatchSortableEvent, hideGhostForTarget = _ref.hideGhostForTarget, unhideGhostForTarget = _ref.unhideGhostForTarget;
  if (!originalEvent)
    return;
  var toSortable = putSortable2 || activeSortable;
  hideGhostForTarget();
  var touch = originalEvent.changedTouches && originalEvent.changedTouches.length ? originalEvent.changedTouches[0] : originalEvent;
  var target = document.elementFromPoint(touch.clientX, touch.clientY);
  unhideGhostForTarget();
  if (toSortable && !toSortable.el.contains(target)) {
    dispatchSortableEvent("spill");
    this.onSpill({
      dragEl: dragEl2,
      putSortable: putSortable2
    });
  }
};
function Revert() {
}
Revert.prototype = {
  startIndex: null,
  dragStart: function dragStart(_ref2) {
    var oldDraggableIndex2 = _ref2.oldDraggableIndex;
    this.startIndex = oldDraggableIndex2;
  },
  onSpill: function onSpill(_ref3) {
    var dragEl2 = _ref3.dragEl, putSortable2 = _ref3.putSortable;
    this.sortable.captureAnimationState();
    if (putSortable2) {
      putSortable2.captureAnimationState();
    }
    var nextSibling = getChild(this.sortable.el, this.startIndex, this.options);
    if (nextSibling) {
      this.sortable.el.insertBefore(dragEl2, nextSibling);
    } else {
      this.sortable.el.appendChild(dragEl2);
    }
    this.sortable.animateAll();
    if (putSortable2) {
      putSortable2.animateAll();
    }
  },
  drop
};
_extends(Revert, {
  pluginName: "revertOnSpill"
});
function Remove() {
}
Remove.prototype = {
  onSpill: function onSpill2(_ref4) {
    var dragEl2 = _ref4.dragEl, putSortable2 = _ref4.putSortable;
    var parentSortable = putSortable2 || this.sortable;
    parentSortable.captureAnimationState();
    dragEl2.parentNode && dragEl2.parentNode.removeChild(dragEl2);
    parentSortable.animateAll();
  },
  drop
};
_extends(Remove, {
  pluginName: "removeOnSpill"
});
Sortable.mount(new AutoScrollPlugin());
Sortable.mount(Remove, Revert);
var sortable_esm_default = Sortable;

// src/editor/extensions.ts
var import_commands = __toModule(require("@codemirror/commands"));

// node_modules/@lezer/css/dist/index.js
var import_lr = __toModule(require("@lezer/lr"));
var import_highlight = __toModule(require("@lezer/highlight"));
var descendantOp = 145;
var Unit = 1;
var identifier = 146;
var callee = 147;
var VariableName = 2;
var queryIdentifier = 148;
var queryVariableName = 3;
var QueryCallee = 4;
var space = [
  9,
  10,
  11,
  12,
  13,
  32,
  133,
  160,
  5760,
  8192,
  8193,
  8194,
  8195,
  8196,
  8197,
  8198,
  8199,
  8200,
  8201,
  8202,
  8232,
  8233,
  8239,
  8287,
  12288
];
var colon = 58;
var parenL = 40;
var underscore = 95;
var bracketL = 91;
var dash = 45;
var period = 46;
var hash = 35;
var percent = 37;
var ampersand = 38;
var backslash = 92;
var newline = 10;
var asterisk = 42;
function isAlpha(ch) {
  return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122 || ch >= 161;
}
function isDigit(ch) {
  return ch >= 48 && ch <= 57;
}
function isHex(ch) {
  return isDigit(ch) || ch >= 97 && ch <= 102 || ch >= 65 && ch <= 70;
}
var identifierTokens = (id, varName, callee2) => (input, stack) => {
  for (let inside = false, dashes = 0, i = 0; ; i++) {
    let { next } = input;
    if (isAlpha(next) || next == dash || next == underscore || inside && isDigit(next)) {
      if (!inside && (next != dash || i > 0))
        inside = true;
      if (dashes === i && next == dash)
        dashes++;
      input.advance();
    } else if (next == backslash && input.peek(1) != newline) {
      input.advance();
      if (isHex(input.next)) {
        do {
          input.advance();
        } while (isHex(input.next));
        if (input.next == 32)
          input.advance();
      } else if (input.next > -1) {
        input.advance();
      }
      inside = true;
    } else {
      if (inside)
        input.acceptToken(dashes == 2 && stack.canShift(VariableName) ? varName : next == parenL ? callee2 : id);
      break;
    }
  }
};
var identifiers = new import_lr.ExternalTokenizer(identifierTokens(identifier, VariableName, callee), { contextual: true });
var queryIdentifiers = new import_lr.ExternalTokenizer(identifierTokens(queryIdentifier, queryVariableName, QueryCallee), { contextual: true });
var descendant = new import_lr.ExternalTokenizer((input) => {
  if (space.includes(input.peek(-1))) {
    let { next } = input;
    if (isAlpha(next) || next == underscore || next == hash || next == period || next == asterisk || next == bracketL || next == colon && isAlpha(input.peek(1)) || next == dash || next == ampersand)
      input.acceptToken(descendantOp);
  }
});
var unitToken = new import_lr.ExternalTokenizer((input) => {
  if (!space.includes(input.peek(-1))) {
    let { next } = input;
    if (next == percent) {
      input.advance();
      input.acceptToken(Unit);
    }
    if (isAlpha(next)) {
      do {
        input.advance();
      } while (isAlpha(input.next) || isDigit(input.next));
      input.acceptToken(Unit);
    }
  }
});
var cssHighlighting = (0, import_highlight.styleTags)({
  "AtKeyword import charset namespace keyframes media supports font-feature-values": import_highlight.tags.definitionKeyword,
  "from to selector scope MatchFlag": import_highlight.tags.keyword,
  NamespaceName: import_highlight.tags.namespace,
  KeyframeName: import_highlight.tags.labelName,
  KeyframeRangeName: import_highlight.tags.operatorKeyword,
  TagName: import_highlight.tags.tagName,
  ClassName: import_highlight.tags.className,
  PseudoClassName: import_highlight.tags.constant(import_highlight.tags.className),
  IdName: import_highlight.tags.labelName,
  "FeatureName PropertyName": import_highlight.tags.propertyName,
  AttributeName: import_highlight.tags.attributeName,
  NumberLiteral: import_highlight.tags.number,
  KeywordQuery: import_highlight.tags.keyword,
  UnaryQueryOp: import_highlight.tags.operatorKeyword,
  "CallTag ValueName FontName": import_highlight.tags.atom,
  VariableName: import_highlight.tags.variableName,
  Callee: import_highlight.tags.operatorKeyword,
  Unit: import_highlight.tags.unit,
  "UniversalSelector NestingSelector": import_highlight.tags.definitionOperator,
  "MatchOp CompareOp": import_highlight.tags.compareOperator,
  "ChildOp SiblingOp, LogicOp": import_highlight.tags.logicOperator,
  BinOp: import_highlight.tags.arithmeticOperator,
  Important: import_highlight.tags.modifier,
  Comment: import_highlight.tags.blockComment,
  ColorLiteral: import_highlight.tags.color,
  "ParenthesizedContent StringLiteral": import_highlight.tags.string,
  ":": import_highlight.tags.punctuation,
  "PseudoOp #": import_highlight.tags.derefOperator,
  "; , |": import_highlight.tags.separator,
  "( )": import_highlight.tags.paren,
  "[ ]": import_highlight.tags.squareBracket,
  "{ }": import_highlight.tags.brace
});
var spec_callee = { __proto__: null, lang: 44, "nth-child": 44, "nth-last-child": 44, "nth-of-type": 44, "nth-last-of-type": 44, dir: 44, "host-context": 44, if: 90, url: 152, "url-prefix": 152, domain: 152, regexp: 152 };
var spec_queryIdentifier = { __proto__: null, or: 104, and: 104, not: 112, only: 112, layer: 206 };
var spec_QueryCallee = { __proto__: null, selector: 118, style: 124, layer: 202 };
var spec_AtKeyword = { __proto__: null, "@import": 198, "@media": 210, "@charset": 214, "@namespace": 218, "@keyframes": 224, "@supports": 236, "@scope": 240, "@font-feature-values": 246 };
var spec_identifier = { __proto__: null, to: 243 };
var parser = import_lr.LRParser.deserialize({
  version: 14,
  states: "MlQYQdOOO#}QdOOP$UO`OOO%OQaO'#CfOOQP'#Ce'#CeO%VQdO'#CgO%[Q`O'#CgO%aQaO'#FnO&XQdO'#CkO&xQaO'#CcO'SQdO'#CnO'_QdO'#EOO'dQdO'#EQO'oQdO'#EXO'oQdO'#E[OOQP'#Fn'#FnO)RQhO'#E}OOQS'#Fm'#FmOOQS'#FQ'#FQQYQdOOO)YQdO'#EbO*iQhO'#EhO)YQdO'#EjO*pQdO'#ElO*{QdO'#EoO)}QhO'#EuO+TQdO'#EwO+`QdO'#EzO+eQaO'#CfO+lQ`O'#E_O+qQ`O'#F{O+|QdO'#F{QOQ`OOP,WO&jO'#CaPOOO)CA])CA]OOQP'#Ci'#CiOOQP,59R,59RO%VQdO,59ROOQP'#Cm'#CmOOQP,59V,59VO&XQdO,59VO,cQdO,59YO'_QdO,5:jO'dQdO,5:lO'oQdO,5:sO'oQdO,5:uO'oQdO,5:vO'oQdO'#FXO,nQ`O,58}O,vQdO'#E^OOQS,58},58}OOQP'#Cq'#CqOOQO'#D|'#D|OOQP,59Y,59YO,}Q`O,59YO-SQ`O,59YOOQP'#EP'#EPOOQP,5:j,5:jO-XQpO'#ERO-dQdO'#ESO-iQ`O'#ESO-nQpO,5:lO.XQaO,5:sO.oQaO,5:vOOQW'#D^'#D^O/nQhO'#DgO0RQhO,5;iO)}QhO'#DeO0`Q`O'#DnO0eQhO'#DxOOQW'#Ft'#FtOOQS,5;i,5;iO0jQ`O'#DhO0oQ`O'#DkOOQS-E9O-E9OOOQ['#Cv'#CvO0tQdO'#CwO1[QdO'#C}O1rQdO'#DQO2YQ!pO'#DSO4fQ!jO,5:|OOQO'#DX'#DXO-SQ`O'#DWO4vQ!nO'#FqO6|Q`O'#DYO7RQ`O'#DyOOQ['#Fq'#FqO7WQhO'#GOO7fQ`O,5;SO7kQ!bO,5;UOOQS'#En'#EnO7sQ`O,5;WO7xQdO,5;WOOQO'#Eq'#EqO8QQ`O,5;ZO8VQhO,5;aO'oQdO'#DjOOQS,5;c,5;cO0jQ`O,5;cO8_QdO,5;cOOQS'#F`'#F`O8gQdO'#E|O7fQ`O,5;fO8oQdO,5:yO9PQdO'#FZO9^Q`O,5<gO9^Q`O,5<gPOOO'#FP'#FPP9iO&jO,58{POOO,58{,58{OOQP1G.m1G.mOOQP1G.q1G.qOOQP1G.t1G.tO,}Q`O1G.tO-SQ`O1G.tOOQP1G0U1G0UO9tQpO1G0WO9|QaO1G0_O:dQaO1G0aO:zQaO1G0bO;bQaO,5;sOOQO-E9V-E9VOOQS1G.i1G.iO;lQ`O,5:xO;qQdO'#D}O;xQdO'#CuOOQO'#EU'#EUOOQO,5:n,5:nO-dQdO,5:nOOQP1G0W1G0WO)YQdO1G0WO<PQ!jO'#D^O<_Q!bO,59yO<gQhO,5:ROOQO'#Fu'#FuO<bQ!bO,59}O<oQhO'#FaO)}QhO,59{O)}QhO'#FaO=gQhO1G1TOOQS1G1T1G1TO=qQhO,5:PO>lQhO'#DoOOQW,5:Y,5:YOOQW,5:d,5:dOOQW,5:S,5:SO>vQhO,5:VO?bQ!fO'#FrOOQS'#Fr'#FrOOQS'#FS'#FSO@rQdO,59cOOQ[,59c,59cOAYQdO,59iOOQ[,59i,59iOApQdO,59lOOQ[,59l,59lOOQ[,59n,59nO)YQdO,59pOBWQhO'#EdOOQW'#Ed'#EdOBuQ`O1G0hO4oQhO1G0hOOQ[,59r,59rO)}QhO'#D[OOQ[,59t,59tOBzQ#tO,5:eOCVQhO'#F]OCdQ`O,5<jOOQS1G0n1G0nOOQS1G0p1G0pOOQS1G0r1G0rOCoQ`O1G0rOCtQdO'#ErOOQS1G0u1G0uOOQS1G0{1G0{ODPQaO,5:UO7fQ`O1G0}OOQS1G0}1G0}O0jQ`O1G0}OOQS-E9^-E9^OOQS1G1Q1G1QODWQ!fO1G0eODnQ`O'#EaOOQO1G0e1G0eOOQO,5;u,5;uODsQdO,5;uOOQO-E9X-E9XOEQQ`O1G2RPOOO-E8}-E8}POOO1G.g1G.gOOQP7+$`7+$`OOQP7+%r7+%rO)YQdO7+%rOOQS1G0d1G0dOE]QaO'#FzOEgQ`O,5:iOElQ!fO'#FROFjQdO'#FpOFtQ`O,59aOOQO1G0Y1G0YOFyQ!bO7+%rO)YQdO1G/eOGUQhO1G/iOOQW1G/m1G/mOOQW1G/g1G/gOGgQhO,5;{OOQW-E9_-E9_OOQS7+&o7+&oOH_QhO'#D^OHmQhO'#FxOHxQ`O'#FxOH}Q`O,5:ZOISQ!bO'#D`O>vQhO'#DmOI_QhO'#DqOIgQhO'#DsOIlQhO'#FwOOQO'#Fw'#FwOItQ!bO'#DwOOQO'#Fy'#FyOOQO'#Fv'#FvOIyQ`O1G/qOOQS-E9Q-E9QOOQ[1G.}1G.}OOQ[1G/T1G/TOOQ[1G/W1G/WOOQ[1G/[1G/[OJOQdO,5;OOOQS7+&S7+&SOJTQ`O7+&SOJYQhO'#D]OJbQ`O,59vO)}QhO,59vOOQ[1G0P1G0POJjQ`O1G0POJoQhO,5;wOOQO-E9Z-E9ZOOQS7+&^7+&^OJ}QbO'#DSOOQO'#Et'#EtOK]Q`O'#EsOOQO'#Es'#EsOKhQ`O'#F^OKpQdO,5;^OOQS,5;^,5;^OOQ[1G/p1G/pOOQS7+&i7+&iO7fQ`O7+&iOK{Q!fO'#FYO)YQdO'#FYOMSQdO7+&POOQO7+&P7+&POOQO,5:{,5:{OOQO1G1a1G1aOMgQ!bO<<I^OMrQdO'#FWOM|Q`O,5<fOOQP1G0T1G0TOOQS-E9P-E9PONUQdO'#FVON`Q`O,5<[OOQ]1G.{1G.{OOQP<<I^<<I^ONhQ`O<<I^ONmQdO7+%POOQO'#D`'#D`ONtQ!bO7+%TON|QhO'#FUO! ZQ`O,5<dO)YQdO,5<dOOQW1G/u1G/uO)YQdO,5:bO! cQ`O,5:XO>vQhO'#DrOOQO,5:],5:]O! hQhO,5:_OGUQhO,5:cOOQW7+%]7+%]OOQO'#Ef'#EfO! pQ`O1G0jOOQS<<In<<InO)YQdO,59wO!!dQhO1G/bOOQ[1G/b1G/bO!!kQ`O1G/bOOQW-E9R-E9ROOQ[7+%k7+%kOOQO,5;_,5;_OCwQdO'#F_OKhQ`O,5;xOOQS,5;x,5;xOOQS-E9[-E9[OOQS1G0x1G0xOOQS<<JT<<JTO!!sQ!fO,5;tOOQS-E9W-E9WOOQO<<Ik<<IkOOQPAN>xAN>xO!#zQ`OAN>xO!$PQaO,5;rOOQO-E9U-E9UO!$ZQdO,5;qOOQO-E9T-E9TOOQW<<Hk<<HkOOQW<<Ho<<HoO!$eQhO<<HoO!$vQhO,5;pO!%RQ`O,5;pOOQO-E9S-E9SO!%WQdO1G2OO!%bQdO1G/|O!%iQhO1G/sO!%qQ`O,5:^O>vQhO'#DuOOQO1G/y1G/yO!%vQ!bO1G/}OJOQdO'#F[O!&OQ`O7+&UOOQW7+&U7+&UO!&WQ!bO1G/cOOQ[7+$|7+$|O!&cQhO7+$|P!&jQ`O'#FTOOQO,5;y,5;yOOQO-E9]-E9]OOQS1G1d1G1dOOQPG24dG24dO!&oQ`OAN>ZO)YQdO1G1[O!&tQ`O7+'jOOQO1G/x1G/xO!&|Q`O,5:aO!$eQhO7+%iOOQO,5;v,5;vOOQO-E9Y-E9YOOQW<<Ip<<IpOOQ[<<Hh<<HhPOQW,5;o,5;oOOQWG23uG23uO!'RQdO7+&vOOQO1G/{1G/{OOQO<<IT<<IT",
  stateData: "!'f~O$[OS$]QQ~OWVO^_O`WOcYOdYOl`OmZOp[O!|]O#P^O#VdO#]eO#_fO#agO#dhO#jiO#ljO#okO$WRO$cTO~OQmOWVO^_O`WOcYOdYOl`OmZOp[O!|]O#P^O#VdO#]eO#_fO#agO#dhO#jiO#ljO#okO$WlO$cTO~O$U$oP~P!jO$]qO~O`YXcYXdYXmYXpYXsYX!dYX!|YX#PYX$VYX$c[X~OgYX~P$ZO$WsO~O$cuO~O$cuO`$bXc$bXd$bXm$bXp$bXs$bX!d$bX!|$bX#P$bX$V$bXg$bX~O$WvO~O`xOcyOdyOmzOp{O!||O#P!OO$V}O~Os!RO!d!PO~P&^Of!XO$W!TO$X!UO~O$W!YO~OW!^O$W![O$c!]O~OWVO^_O`WOcYOdYOmZOp[O!|]O#P^O$WRO$cTO~OS!fOc!gOd!gOh!cOs!RO!Y!eO!]!jO!`!kO$Y!bO~On!iO~P(dOQ!uOh!nOp!oOs!pOu!xOw!xO}!vO!n!wO$W!mO$X!sO$g!qO~OS!fOc!gOd!gOh!cO!Y!eO!]!jO!`!kO$Y!bO~Os$rP~P)}Ow!}O!n!wO$W!|O~Ow#PO$W#PO~Oh#SOs!RO#m#UO~O$W#WO~Oc#SX~P$ZOc#ZO~On#[O$U$oXr$oX~O$U$oXr$oX~P!jO$^#_O$_#_O$`#aO~Of#fO$W!TO$X!UO~Os!RO!d!PO~Or$oP~P!jOh#pO~Oh#qO~Oo!uX!y!uX$c!wX~O$W#rO~O$c#tO~Oo#uO!y#vO~O`xOcyOdyOmzOp{O~Os!{a!d!{a!|!{a#P!{a$V!{ag!{a~P-vOs#Oa!d#Oa!|#Oa#P#Oa$V#Oag#Oa~P-vOS!fOc!gOd!gOh!cO!Y!eO!]!jO!`!kO~OR#zOu#zOw#zO$Y#wO$g!qO~P/VOn$QO!U#}O!d$OO~P(dOh$SO~O$Y$UO~Oh#SO~Oh$WO~O`$YOc$YOg$]Ol$YOm$YOn$YO~P)YO`$YOc$YOl$YOm$YOn$YOo$_O~P)YO`$YOc$YOl$YOm$YOn$YOr$aO~P)YOP$bOSvXcvXdvXhvXnvXyvX!YvX!]vX!`vX#XvX#ZvX$YvX!WvXQvX`vXgvXlvXmvXpvXsvXuvXwvX}vX!nvX$WvX$XvX$gvXovXrvX!dvX$UvX$qvX!zvX~Oy$cO#X$dO#Z$eOn$rP~P)}Oh#qOS$eXc$eXd$eXn$eXy$eX!Y$eX!]$eX!`$eX#X$eX#Z$eX$Y$eXQ$eX`$eXg$eXl$eXm$eXp$eXs$eXu$eXw$eX}$eX!n$eX$W$eX$X$eX$g$eXo$eXr$eX!d$eX$U$eX$q$eX!z$eX~Oh$iO~Oh$kO~O!U#}O!d$lOs$rXn$rX~Os!RO~On$oOy$cO~On$pO~Ow$qO!n!wO~Os$rO~Os!RO!U#}O~Os!RO#m$xO~O$W#WOs#pX~O$q$|On#Ra$U#Rar#Ra~P)YOn#}X$U#}Xr#}X~P!jOn#[O$U$oar$oa~O$^#_O$_#_O$`%TO~Oo%VO!y%WO~Os!{i!d!{i!|!{i#P!{i$V!{ig!{i~P-vOs!}i!d!}i!|!}i#P!}i$V!}ig!}i~P-vOs#Oi!d#Oi!|#Oi#P#Oi$V#Oig#Oi~P-vOs#{a!d#{a~P&^Or%XO~Og$nP~P'oOg$dP~P)YOc!SXg!QX!U!QX!W!SX~Oc%aO!W%bO~Og%cO!U#}O~O!U#}OS$TXc$TXd$TXh$TXn$TXs$TX!Y$TX!]$TX!`$TX!d$TX$Y$TX~On%gO!d$OO~P(dO!U#}OS!Xac!Xad!Xah!Xan!Xas!Xa!Y!Xa!]!Xa!`!Xa!d!Xa$Y!Xag!Xa~O$Y%hOg$lP~P/VOR#zOS!fOh%mOu#zOw#zO!Y%nO$Y%lO$g!qO~Oy$cOQ$fX`$fXc$fXg$fXh$fXl$fXm$fXn$fXp$fXs$fXu$fXw$fX}$fX!n$fX$W$fX$X$fX$g$fXo$fXr$fX~O`$YOc$YOg%wOl$YOm$YOn$YO~P)YO`$YOc$YOl$YOm$YOn$YOo%xO~P)YO`$YOc$YOl$YOm$YOn$YOr%yO~P)YOh%{OS#WXc#WXd#WXn#WX!Y#WX!]#WX!`#WX$Y#WX~On%|O~Og&ROw&SO!o&SO~Os$PX!d$PXn$PX~P)}O!d$lOs$ran$ra~On&VO~Or&^O$W&XO$g&WO~Og&_O~P&^Oy$cO!d&cO$q$|On#Ri$U#Rir#Ri~P)YO$p&fO~On#}a$U#}ar#}a~P!jOn#[O$U$oir$oi~O!d&iOg$nX~P&^Og&kO~Oy$cOQ#uXg#uXh#uXp#uXs#uXu#uXw#uX}#uX!d#uX!n#uX$W#uX$X#uX$g#uX~O!d&mOg$dX~P)YOg&oO~Oo&pOy$cO!z&qO~OR#zOu#zOw#zO$Y&sO$g!qO~O!U#}OS$Tac$Tad$Tah$Tan$Tas$Ta!Y$Ta!]$Ta!`$Ta!d$Ta$Y$Ta~Oc!SXg!QX!U!QX!d!QX~O!U#}O!d&uOg$lX~Oc&wO~Og&xO~Oc&yOg!jX!W!SX~OS!fOh&{O~O!U&}O~O!U&}Og$kX~O!W'OO~Og'PO~O$W'QO~On'SO~Oc'TO!U#}O~Og'VOn'UO~Og'YO~O!U#}Os$Pa!d$Pan$Pa~OP$bOsvX!dvXgvX~O$g&WOs#gX!d#gX~Os!RO!d'[O~Or'`O$W&XO$g&WO~Oy$cOQ#|Xh#|Xn#|Xp#|Xs#|Xu#|Xw#|X}#|X!d#|X!n#|X$U#|X$W#|X$X#|X$g#|X$q#|Xr#|X~O!d&cO$q$|On#Rq$U#Rqr#Rq~P)YOo'eOy$cO!z'fO~Og#zX!d#zX~P'oO!d&iOg$na~Og#yX!d#yX~P)YO!d&mOg$da~Oo'eO~Og'kO~P)YOg'lO!W'mO~O$Y%hOg#xX!d#xX~P/VO!d&uOg$la~Og'sO~OS!fOh'uO~O`'xOg'zO~OS#wac#wad#wah#wa!Y#wa!]#wa!`#wa$Y#wa~Og'|O~P! xOg'|On'}O~Oy$cOQ#|ah#|an#|ap#|as#|au#|aw#|a}#|a!d#|a!n#|a$U#|a$W#|a$X#|a$g#|a$q#|ar#|a~Oo(SO~Og#za!d#za~P&^Og#ya!d#ya~P)YOR#zOu#zOw#zO$Y&sO$g&WO~O!U#}Og#xa!d#xa~Oc(UO~O!d&uOg$li~P)YOg!ji~P)YOg!ai!U!hi~Og(WO~O!W(YOg!ki~O`'xOg(]O~Oy$cOg!Pin!Pi~Og(^O~P! xOn(_O~Og(`O~O!d&uOg$lq~Og(bO~Og#xq!d#xq~P)YO$[!o$]$g`$gy#P~",
  goto: "7[$sPPPPP$tP$wP%Q%d%Q%v&YP%QP&`%QPP&fPPP&l&v&vPPPPP&vPP&vP'fP&vP&v(i&vP)X)[)b)b)t)bP)bP)bP)b)bP*a)bP*m*s+cP*m+f*m+i+`+o+o)b+uPP,k,q%Q,w%Q,},}-T-XPP%QP%Q%QP-_.Z.h.o$wP.xP.{P$wP$wP$wP/R$wP/U/X/[/c$wP$wPP$wP/h$wP/k/q0Q0l0z1Q1[1b1h1n1t2O2U2[2b2h2nPPPPPPPPPPP2t2}P3s3v4zP5S5|6c6o6u6o6x6{PP7RRrQ_aOPco!R#[%Pq_OP]^co|}!O!P!R#S#[#p%P&iqSOP]^co|}!O!P!R#S#[#p%P&iqUOP]^co|}!O!P!R#S#[#p%P&iQtTR#buQwWR#cxQ!VYR#dyQ#d!XS$h!t!uR%U#f!Z!xdf!n!o!p#Z#q#v$[$^$`$c${%W%]%a&c&d&m&r&w&y'T'i'q'r(U(a!Y!xdf!n!o!p#Z#q#v$[$^$`$c${%W%]%a&c&d&m&r&w&y'T'i'q'r(U(ab#z!c$W%b%m&{'O'm'u(YU&Z$r&]'[R'Z&Y!Z!tdf!n!o!p#Z#q#v$[$^$`$c${%W%]%a&c&d&m&r&w&y'T'i'q'r(U(aR$j!vQ&P$iR'W&Qq!h`ei!c!d!e!r#}$O$P$S$g$i$l&Q&uQ#x!cQ%j$SW%r$W%m&{'uQ&t%bQ'o&uQ'w'OQ(T'mR(c(YQ#VjQ$V!jQ$v#UR&a$xX%q$W%m&{'up!h`ei!c!d!e!r#}$O$P$S$g$i$l&Q&uW%p$W%m&{'uQ&|%nR'v&}R$T!fR&|%nX%o$W%m&{'uX%s$W%m&{'u!Y!xdf!n!o!p#Z#q#v$[$^$`$c${%W%]%a&c&d&m&r&w&y'T'i'q'r(U(aQ!}gR$q#OQ!WYR#eyQ#d!WR%U#eQ!ZZR#gzQ!_[R#h{T!^[{Q#s!]R%_#tQ!SXQ!i`Q#TjQ#n!QQ$Q!dQ$n!zQ$t#RQ$w#VQ$z#YQ%g$PQ&`$vQ'^&[Q'a&aR(R']SnP!RQ#^oQ%O#[R&g%PZmPo!R#[%PQ$}#ZQ&e${R'd&dR$g!rQ'R%{R(Z'xR#OgR#QhR$s#QS&[$r&]R(P'[V&Y$r&]'[R#YkQ#`qR%S#`QcOSoP!RU!lco%PR%P#[Q%]#q[&l%]&r'i'q'r(aQ&r%aQ'i&mQ'q&wQ'r&yR(a(UQ$[!nQ$^!oQ$`!pV%v$[$^$`Q&Q$iR'X&QQ&v%iS'p&v(VR(V'qQ&n%]R'j&nQ&j%YR'h&jQ!QXR#m!QQ&d${R'c&dQ#]nS%Q#]%RR%R#^Q'y'RR(['yQ$m!yR&U$mQ&]$rR'_&]Q']&[R(Q']Q#XkR$y#XQ$P!dR%f$P_bOPco!R#[%P^XOPco!R#[%PQ!`]Q!a^Q#i|Q#j}Q#k!OQ#l!PQ$u#SQ%Y#pR'g&iR%^#qQ!rdQ!{f[$X!n!o!p$[$^$`Q${#Zh%[#q%]%a&m&r&w&y'i'q'r(U(aQ%`#vQ%z$cS&b${&dQ&h%WQ'b&cR'{'T]$Z!n!o!p$[$^$`Q!d`U!ye!r$gQ#RiQ#y!cS#|!d$PQ$R!eQ%d#}Q%e$OQ%i$SS&O$i&QQ&T$lR'n&uQ#{!cW%r$W%m&{'uQ&t%bQ'w'OQ(T'mR(c(YQ%u$WQ&z%mQ't&{R(X'uX%t$W%m&{'uR%k$SR%Z#pQpPR#o!RQ!zeQ$f!rR%}$g",
  nodeNames: "\u26A0 Unit VariableName VariableName QueryCallee Comment StyleSheet RuleSet UniversalSelector TagSelector TagName NamespacedTagSelector NamespaceName TagName NestingSelector ClassSelector . ClassName PseudoClassSelector : :: PseudoClassName PseudoClassName ) ( ArgList ValueName ParenthesizedValue AtKeyword # ; ] [ BracketedValue } { BracedValue ColorLiteral NumberLiteral StringLiteral BinaryExpression BinOp CallExpression Callee IfExpression if ArgList IfBranch KeywordQuery FeatureQuery FeatureName BinaryQuery LogicOp ComparisonQuery CompareOp UnaryQuery UnaryQueryOp ParenthesizedQuery SelectorQuery selector ParenthesizedSelector StyleQuery style ParenthesedQuery CallQuery ArgList , UnaryQuery ParenthesedQuery BinaryQuery ParenthesedQuery ParenthesedQuery StyleFeature StyleRange PseudoQuery CallLiteral CallTag ParenthesizedContent PseudoClassName ArgList IdSelector IdName AttributeSelector AttributeName NamespacedAttribute NamespaceName AttributeName MatchOp MatchFlag ChildSelector ChildOp DescendantSelector SiblingSelector SiblingOp Block Declaration PropertyName Important ImportStatement import Layer layer LayerName layer MediaStatement media CharsetStatement charset NamespaceStatement namespace NamespaceName KeyframesStatement keyframes KeyframeName KeyframeList KeyframeSelector KeyframeRangeName SupportsStatement supports ScopeStatement scope to FontFeatureStatement font-feature-values FontName AtRule Styles",
  maxTerm: 172,
  nodeProps: [
    ["isolate", -2, 5, 39, ""],
    ["openedBy", 23, "(", 31, "[", 34, "{"],
    ["closedBy", 24, ")", 32, "]", 35, "}"]
  ],
  propSources: [cssHighlighting],
  skippedNodes: [0, 5, 127],
  repeatNodeCount: 17,
  tokenData: "K`~R!bOX%ZX^&R^p%Zpq&Rqr)ers)vst+jtu2Xuv%Zvw3Rwx3dxy5Ryz5dz{5i{|6S|}:u}!O;W!O!P;u!P!Q<^!Q![=V![!]>Q!]!^>|!^!_?_!_!`@Z!`!a@n!a!b%Z!b!cAo!c!k%Z!k!lC|!l!u%Z!u!vC|!v!}%Z!}#OD_#O#P%Z#P#QDp#Q#R2X#R#]%Z#]#^ER#^#g%Z#g#hC|#h#o%Z#o#pIf#p#qIw#q#rJ`#r#sJq#s#y%Z#y#z&R#z$f%Z$f$g&R$g#BY%Z#BY#BZ&R#BZ$IS%Z$IS$I_&R$I_$I|%Z$I|$JO&R$JO$JT%Z$JT$JU&R$JU$KV%Z$KV$KW&R$KW&FU%Z&FU&FV&R&FV;'S%Z;'S;=`KY<%lO%Z`%^SOy%jz;'S%j;'S;=`%{<%lO%j`%oS!o`Oy%jz;'S%j;'S;=`%{<%lO%j`&OP;=`<%l%j~&Wh$[~OX%jX^'r^p%jpq'rqy%jz#y%j#y#z'r#z$f%j$f$g'r$g#BY%j#BY#BZ'r#BZ$IS%j$IS$I_'r$I_$I|%j$I|$JO'r$JO$JT%j$JT$JU'r$JU$KV%j$KV$KW'r$KW&FU%j&FU&FV'r&FV;'S%j;'S;=`%{<%lO%j~'yh$[~!o`OX%jX^'r^p%jpq'rqy%jz#y%j#y#z'r#z$f%j$f$g'r$g#BY%j#BY#BZ'r#BZ$IS%j$IS$I_'r$I_$I|%j$I|$JO'r$JO$JT%j$JT$JU'r$JU$KV%j$KV$KW'r$KW&FU%j&FU&FV'r&FV;'S%j;'S;=`%{<%lO%jj)jS$qYOy%jz;'S%j;'S;=`%{<%lO%j~)yWOY)vZr)vrs*cs#O)v#O#P*h#P;'S)v;'S;=`+d<%lO)v~*hOw~~*kRO;'S)v;'S;=`*t;=`O)v~*wXOY)vZr)vrs*cs#O)v#O#P*h#P;'S)v;'S;=`+d;=`<%l)v<%lO)v~+gP;=`<%l)vj+oYmYOy%jz!Q%j!Q![,_![!c%j!c!i,_!i#T%j#T#Z,_#Z;'S%j;'S;=`%{<%lO%jj,dY!o`Oy%jz!Q%j!Q![-S![!c%j!c!i-S!i#T%j#T#Z-S#Z;'S%j;'S;=`%{<%lO%jj-XY!o`Oy%jz!Q%j!Q![-w![!c%j!c!i-w!i#T%j#T#Z-w#Z;'S%j;'S;=`%{<%lO%jj.OYuY!o`Oy%jz!Q%j!Q![.n![!c%j!c!i.n!i#T%j#T#Z.n#Z;'S%j;'S;=`%{<%lO%jj.uYuY!o`Oy%jz!Q%j!Q![/e![!c%j!c!i/e!i#T%j#T#Z/e#Z;'S%j;'S;=`%{<%lO%jj/jY!o`Oy%jz!Q%j!Q![0Y![!c%j!c!i0Y!i#T%j#T#Z0Y#Z;'S%j;'S;=`%{<%lO%jj0aYuY!o`Oy%jz!Q%j!Q![1P![!c%j!c!i1P!i#T%j#T#Z1P#Z;'S%j;'S;=`%{<%lO%jj1UY!o`Oy%jz!Q%j!Q![1t![!c%j!c!i1t!i#T%j#T#Z1t#Z;'S%j;'S;=`%{<%lO%jj1{SuY!o`Oy%jz;'S%j;'S;=`%{<%lO%jd2[UOy%jz!_%j!_!`2n!`;'S%j;'S;=`%{<%lO%jd2uS!yS!o`Oy%jz;'S%j;'S;=`%{<%lO%jb3WS^QOy%jz;'S%j;'S;=`%{<%lO%j~3gWOY3dZw3dwx*cx#O3d#O#P4P#P;'S3d;'S;=`4{<%lO3d~4SRO;'S3d;'S;=`4];=`O3d~4`XOY3dZw3dwx*cx#O3d#O#P4P#P;'S3d;'S;=`4{;=`<%l3d<%lO3d~5OP;=`<%l3dj5WShYOy%jz;'S%j;'S;=`%{<%lO%j~5iOg~n5pUWQyWOy%jz!_%j!_!`2n!`;'S%j;'S;=`%{<%lO%jj6ZWyW#PQOy%jz!O%j!O!P6s!P!Q%j!Q![9x![;'S%j;'S;=`%{<%lO%jj6xU!o`Oy%jz!Q%j!Q![7[![;'S%j;'S;=`%{<%lO%jj7cY!o`$gYOy%jz!Q%j!Q![7[![!g%j!g!h8R!h#X%j#X#Y8R#Y;'S%j;'S;=`%{<%lO%jj8WY!o`Oy%jz{%j{|8v|}%j}!O8v!O!Q%j!Q![9_![;'S%j;'S;=`%{<%lO%jj8{U!o`Oy%jz!Q%j!Q![9_![;'S%j;'S;=`%{<%lO%jj9fU!o`$gYOy%jz!Q%j!Q![9_![;'S%j;'S;=`%{<%lO%jj:P[!o`$gYOy%jz!O%j!O!P7[!P!Q%j!Q![9x![!g%j!g!h8R!h#X%j#X#Y8R#Y;'S%j;'S;=`%{<%lO%jj:zS!dYOy%jz;'S%j;'S;=`%{<%lO%jj;]WyWOy%jz!O%j!O!P6s!P!Q%j!Q![9x![;'S%j;'S;=`%{<%lO%jj;zU`YOy%jz!Q%j!Q![7[![;'S%j;'S;=`%{<%lO%j~<cTyWOy%jz{<r{;'S%j;'S;=`%{<%lO%j~<yS!o`$]~Oy%jz;'S%j;'S;=`%{<%lO%jj=[[$gYOy%jz!O%j!O!P7[!P!Q%j!Q![9x![!g%j!g!h8R!h#X%j#X#Y8R#Y;'S%j;'S;=`%{<%lO%jj>VUcYOy%jz![%j![!]>i!];'S%j;'S;=`%{<%lO%jj>pSdY!o`Oy%jz;'S%j;'S;=`%{<%lO%jj?RSnYOy%jz;'S%j;'S;=`%{<%lO%jh?dU!WWOy%jz!_%j!_!`?v!`;'S%j;'S;=`%{<%lO%jh?}S!WW!o`Oy%jz;'S%j;'S;=`%{<%lO%jl@bS!WW!ySOy%jz;'S%j;'S;=`%{<%lO%jj@uV!|Q!WWOy%jz!_%j!_!`?v!`!aA[!a;'S%j;'S;=`%{<%lO%jbAcS!|Q!o`Oy%jz;'S%j;'S;=`%{<%lO%jjArYOy%jz}%j}!OBb!O!c%j!c!}CP!}#T%j#T#oCP#o;'S%j;'S;=`%{<%lO%jjBgW!o`Oy%jz!c%j!c!}CP!}#T%j#T#oCP#o;'S%j;'S;=`%{<%lO%jjCW[lY!o`Oy%jz}%j}!OCP!O!Q%j!Q![CP![!c%j!c!}CP!}#T%j#T#oCP#o;'S%j;'S;=`%{<%lO%jhDRS!zWOy%jz;'S%j;'S;=`%{<%lO%jjDdSpYOy%jz;'S%j;'S;=`%{<%lO%jnDuSo^Oy%jz;'S%j;'S;=`%{<%lO%jjEWU!zWOy%jz#a%j#a#bEj#b;'S%j;'S;=`%{<%lO%jbEoU!o`Oy%jz#d%j#d#eFR#e;'S%j;'S;=`%{<%lO%jbFWU!o`Oy%jz#c%j#c#dFj#d;'S%j;'S;=`%{<%lO%jbFoU!o`Oy%jz#f%j#f#gGR#g;'S%j;'S;=`%{<%lO%jbGWU!o`Oy%jz#h%j#h#iGj#i;'S%j;'S;=`%{<%lO%jbGoU!o`Oy%jz#T%j#T#UHR#U;'S%j;'S;=`%{<%lO%jbHWU!o`Oy%jz#b%j#b#cHj#c;'S%j;'S;=`%{<%lO%jbHoU!o`Oy%jz#h%j#h#iIR#i;'S%j;'S;=`%{<%lO%jbIYS$pQ!o`Oy%jz;'S%j;'S;=`%{<%lO%jjIkSsYOy%jz;'S%j;'S;=`%{<%lO%jfI|U$cUOy%jz!_%j!_!`2n!`;'S%j;'S;=`%{<%lO%jjJeSrYOy%jz;'S%j;'S;=`%{<%lO%jfJvU#PQOy%jz!_%j!_!`2n!`;'S%j;'S;=`%{<%lO%j`K]P;=`<%l%Z",
  tokenizers: [descendant, unitToken, identifiers, queryIdentifiers, 1, 2, 3, 4, new import_lr.LocalTokenGroup("m~RRYZ[z{a~~g~aO$_~~dP!P!Qg~lO$`~~", 28, 152)],
  topRules: { "StyleSheet": [0, 6], "Styles": [1, 126] },
  dynamicPrecedences: { "94": 1 },
  specialized: [{ term: 147, get: (value) => spec_callee[value] || -1 }, { term: 148, get: (value) => spec_queryIdentifier[value] || -1 }, { term: 4, get: (value) => spec_QueryCallee[value] || -1 }, { term: 28, get: (value) => spec_AtKeyword[value] || -1 }, { term: 146, get: (value) => spec_identifier[value] || -1 }],
  tokenPrec: 2405
});

// node_modules/@codemirror/lang-css/dist/index.js
var import_language2 = __toModule(require("@codemirror/language"));
var import_common = __toModule(require("@lezer/common"));
var _properties = null;
function properties() {
  if (!_properties && typeof document == "object" && document.body) {
    let { style } = document.body, names = [], seen = new Set();
    for (let prop in style)
      if (prop != "cssText" && prop != "cssFloat") {
        if (typeof style[prop] == "string") {
          if (/[A-Z]/.test(prop))
            prop = prop.replace(/[A-Z]/g, (ch) => "-" + ch.toLowerCase());
          if (!seen.has(prop)) {
            names.push(prop);
            seen.add(prop);
          }
        }
      }
    _properties = names.sort().map((name) => ({ type: "property", label: name, apply: name + ": " }));
  }
  return _properties || [];
}
var pseudoClasses = /* @__PURE__ */ [
  "active",
  "after",
  "any-link",
  "autofill",
  "backdrop",
  "before",
  "checked",
  "cue",
  "default",
  "defined",
  "disabled",
  "empty",
  "enabled",
  "file-selector-button",
  "first",
  "first-child",
  "first-letter",
  "first-line",
  "first-of-type",
  "focus",
  "focus-visible",
  "focus-within",
  "fullscreen",
  "has",
  "host",
  "host-context",
  "hover",
  "in-range",
  "indeterminate",
  "invalid",
  "is",
  "lang",
  "last-child",
  "last-of-type",
  "left",
  "link",
  "marker",
  "modal",
  "not",
  "nth-child",
  "nth-last-child",
  "nth-last-of-type",
  "nth-of-type",
  "only-child",
  "only-of-type",
  "optional",
  "out-of-range",
  "part",
  "placeholder",
  "placeholder-shown",
  "read-only",
  "read-write",
  "required",
  "right",
  "root",
  "scope",
  "selection",
  "slotted",
  "target",
  "target-text",
  "valid",
  "visited",
  "where"
].map((name) => ({ type: "class", label: name }));
var values = /* @__PURE__ */ [
  "above",
  "absolute",
  "activeborder",
  "additive",
  "activecaption",
  "after-white-space",
  "ahead",
  "alias",
  "all",
  "all-scroll",
  "alphabetic",
  "alternate",
  "always",
  "antialiased",
  "appworkspace",
  "asterisks",
  "attr",
  "auto",
  "auto-flow",
  "avoid",
  "avoid-column",
  "avoid-page",
  "avoid-region",
  "axis-pan",
  "background",
  "backwards",
  "baseline",
  "below",
  "bidi-override",
  "blink",
  "block",
  "block-axis",
  "bold",
  "bolder",
  "border",
  "border-box",
  "both",
  "bottom",
  "break",
  "break-all",
  "break-word",
  "bullets",
  "button",
  "button-bevel",
  "buttonface",
  "buttonhighlight",
  "buttonshadow",
  "buttontext",
  "calc",
  "capitalize",
  "caps-lock-indicator",
  "caption",
  "captiontext",
  "caret",
  "cell",
  "center",
  "checkbox",
  "circle",
  "cjk-decimal",
  "clear",
  "clip",
  "close-quote",
  "col-resize",
  "collapse",
  "color",
  "color-burn",
  "color-dodge",
  "column",
  "column-reverse",
  "compact",
  "condensed",
  "contain",
  "content",
  "contents",
  "content-box",
  "context-menu",
  "continuous",
  "copy",
  "counter",
  "counters",
  "cover",
  "crop",
  "cross",
  "crosshair",
  "currentcolor",
  "cursive",
  "cyclic",
  "darken",
  "dashed",
  "decimal",
  "decimal-leading-zero",
  "default",
  "default-button",
  "dense",
  "destination-atop",
  "destination-in",
  "destination-out",
  "destination-over",
  "difference",
  "disc",
  "discard",
  "disclosure-closed",
  "disclosure-open",
  "document",
  "dot-dash",
  "dot-dot-dash",
  "dotted",
  "double",
  "down",
  "e-resize",
  "ease",
  "ease-in",
  "ease-in-out",
  "ease-out",
  "element",
  "ellipse",
  "ellipsis",
  "embed",
  "end",
  "ethiopic-abegede-gez",
  "ethiopic-halehame-aa-er",
  "ethiopic-halehame-gez",
  "ew-resize",
  "exclusion",
  "expanded",
  "extends",
  "extra-condensed",
  "extra-expanded",
  "fantasy",
  "fast",
  "fill",
  "fill-box",
  "fixed",
  "flat",
  "flex",
  "flex-end",
  "flex-start",
  "footnotes",
  "forwards",
  "from",
  "geometricPrecision",
  "graytext",
  "grid",
  "groove",
  "hand",
  "hard-light",
  "help",
  "hidden",
  "hide",
  "higher",
  "highlight",
  "highlighttext",
  "horizontal",
  "hsl",
  "hsla",
  "hue",
  "icon",
  "ignore",
  "inactiveborder",
  "inactivecaption",
  "inactivecaptiontext",
  "infinite",
  "infobackground",
  "infotext",
  "inherit",
  "initial",
  "inline",
  "inline-axis",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "inline-table",
  "inset",
  "inside",
  "intrinsic",
  "invert",
  "italic",
  "justify",
  "keep-all",
  "landscape",
  "large",
  "larger",
  "left",
  "level",
  "lighter",
  "lighten",
  "line-through",
  "linear",
  "linear-gradient",
  "lines",
  "list-item",
  "listbox",
  "listitem",
  "local",
  "logical",
  "loud",
  "lower",
  "lower-hexadecimal",
  "lower-latin",
  "lower-norwegian",
  "lowercase",
  "ltr",
  "luminosity",
  "manipulation",
  "match",
  "matrix",
  "matrix3d",
  "medium",
  "menu",
  "menutext",
  "message-box",
  "middle",
  "min-intrinsic",
  "mix",
  "monospace",
  "move",
  "multiple",
  "multiple_mask_images",
  "multiply",
  "n-resize",
  "narrower",
  "ne-resize",
  "nesw-resize",
  "no-close-quote",
  "no-drop",
  "no-open-quote",
  "no-repeat",
  "none",
  "normal",
  "not-allowed",
  "nowrap",
  "ns-resize",
  "numbers",
  "numeric",
  "nw-resize",
  "nwse-resize",
  "oblique",
  "opacity",
  "open-quote",
  "optimizeLegibility",
  "optimizeSpeed",
  "outset",
  "outside",
  "outside-shape",
  "overlay",
  "overline",
  "padding",
  "padding-box",
  "painted",
  "page",
  "paused",
  "perspective",
  "pinch-zoom",
  "plus-darker",
  "plus-lighter",
  "pointer",
  "polygon",
  "portrait",
  "pre",
  "pre-line",
  "pre-wrap",
  "preserve-3d",
  "progress",
  "push-button",
  "radial-gradient",
  "radio",
  "read-only",
  "read-write",
  "read-write-plaintext-only",
  "rectangle",
  "region",
  "relative",
  "repeat",
  "repeating-linear-gradient",
  "repeating-radial-gradient",
  "repeat-x",
  "repeat-y",
  "reset",
  "reverse",
  "rgb",
  "rgba",
  "ridge",
  "right",
  "rotate",
  "rotate3d",
  "rotateX",
  "rotateY",
  "rotateZ",
  "round",
  "row",
  "row-resize",
  "row-reverse",
  "rtl",
  "run-in",
  "running",
  "s-resize",
  "sans-serif",
  "saturation",
  "scale",
  "scale3d",
  "scaleX",
  "scaleY",
  "scaleZ",
  "screen",
  "scroll",
  "scrollbar",
  "scroll-position",
  "se-resize",
  "self-start",
  "self-end",
  "semi-condensed",
  "semi-expanded",
  "separate",
  "serif",
  "show",
  "single",
  "skew",
  "skewX",
  "skewY",
  "skip-white-space",
  "slide",
  "slider-horizontal",
  "slider-vertical",
  "sliderthumb-horizontal",
  "sliderthumb-vertical",
  "slow",
  "small",
  "small-caps",
  "small-caption",
  "smaller",
  "soft-light",
  "solid",
  "source-atop",
  "source-in",
  "source-out",
  "source-over",
  "space",
  "space-around",
  "space-between",
  "space-evenly",
  "spell-out",
  "square",
  "start",
  "static",
  "status-bar",
  "stretch",
  "stroke",
  "stroke-box",
  "sub",
  "subpixel-antialiased",
  "svg_masks",
  "super",
  "sw-resize",
  "symbolic",
  "symbols",
  "system-ui",
  "table",
  "table-caption",
  "table-cell",
  "table-column",
  "table-column-group",
  "table-footer-group",
  "table-header-group",
  "table-row",
  "table-row-group",
  "text",
  "text-bottom",
  "text-top",
  "textarea",
  "textfield",
  "thick",
  "thin",
  "threeddarkshadow",
  "threedface",
  "threedhighlight",
  "threedlightshadow",
  "threedshadow",
  "to",
  "top",
  "transform",
  "translate",
  "translate3d",
  "translateX",
  "translateY",
  "translateZ",
  "transparent",
  "ultra-condensed",
  "ultra-expanded",
  "underline",
  "unidirectional-pan",
  "unset",
  "up",
  "upper-latin",
  "uppercase",
  "url",
  "var",
  "vertical",
  "vertical-text",
  "view-box",
  "visible",
  "visibleFill",
  "visiblePainted",
  "visibleStroke",
  "visual",
  "w-resize",
  "wait",
  "wave",
  "wider",
  "window",
  "windowframe",
  "windowtext",
  "words",
  "wrap",
  "wrap-reverse",
  "x-large",
  "x-small",
  "xor",
  "xx-large",
  "xx-small"
].map((name) => ({ type: "keyword", label: name })).concat(/* @__PURE__ */ [
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "grey",
  "green",
  "greenyellow",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "rebeccapurple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen"
].map((name) => ({ type: "constant", label: name })));
var tags2 = /* @__PURE__ */ [
  "a",
  "abbr",
  "address",
  "article",
  "aside",
  "b",
  "bdi",
  "bdo",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "footer",
  "form",
  "header",
  "hgroup",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "main",
  "meter",
  "nav",
  "ol",
  "output",
  "p",
  "pre",
  "ruby",
  "section",
  "select",
  "small",
  "source",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
].map((name) => ({ type: "type", label: name }));
var atRules = /* @__PURE__ */ [
  "@charset",
  "@color-profile",
  "@container",
  "@counter-style",
  "@font-face",
  "@font-feature-values",
  "@font-palette-values",
  "@import",
  "@keyframes",
  "@layer",
  "@media",
  "@namespace",
  "@page",
  "@position-try",
  "@property",
  "@scope",
  "@starting-style",
  "@supports",
  "@view-transition"
].map((label) => ({ type: "keyword", label }));
var identifier2 = /^(\w[\w-]*|-\w[\w-]*|)$/;
var variable = /^-(-[\w-]*)?$/;
function isVarArg(node, doc) {
  var _a;
  if (node.name == "(" || node.type.isError)
    node = node.parent || node;
  if (node.name != "ArgList")
    return false;
  let callee2 = (_a = node.parent) === null || _a === void 0 ? void 0 : _a.firstChild;
  if ((callee2 === null || callee2 === void 0 ? void 0 : callee2.name) != "Callee")
    return false;
  return doc.sliceString(callee2.from, callee2.to) == "var";
}
var VariablesByNode = /* @__PURE__ */ new import_common.NodeWeakMap();
var declSelector = ["Declaration"];
function astTop(node) {
  for (let cur = node; ; ) {
    if (cur.type.isTop)
      return cur;
    if (!(cur = cur.parent))
      return node;
  }
}
function variableNames(doc, node, isVariable) {
  if (node.to - node.from > 4096) {
    let known = VariablesByNode.get(node);
    if (known)
      return known;
    let result = [], seen = new Set(), cursor3 = node.cursor(import_common.IterMode.IncludeAnonymous);
    if (cursor3.firstChild())
      do {
        for (let option2 of variableNames(doc, cursor3.node, isVariable))
          if (!seen.has(option2.label)) {
            seen.add(option2.label);
            result.push(option2);
          }
      } while (cursor3.nextSibling());
    VariablesByNode.set(node, result);
    return result;
  } else {
    let result = [], seen = new Set();
    node.cursor().iterate((node2) => {
      var _a;
      if (isVariable(node2) && node2.matchContext(declSelector) && ((_a = node2.node.nextSibling) === null || _a === void 0 ? void 0 : _a.name) == ":") {
        let name = doc.sliceString(node2.from, node2.to);
        if (!seen.has(name)) {
          seen.add(name);
          result.push({ label: name, type: "variable" });
        }
      }
    });
    return result;
  }
}
var defineCSSCompletionSource = (isVariable) => (context) => {
  let { state, pos } = context, node = (0, import_language2.syntaxTree)(state).resolveInner(pos, -1);
  let isDash = node.type.isError && node.from == node.to - 1 && state.doc.sliceString(node.from, node.to) == "-";
  if (node.name == "PropertyName" || (isDash || node.name == "TagName") && /^(Block|Styles)$/.test(node.resolve(node.to).name))
    return { from: node.from, options: properties(), validFor: identifier2 };
  if (node.name == "ValueName")
    return { from: node.from, options: values, validFor: identifier2 };
  if (node.name == "PseudoClassName")
    return { from: node.from, options: pseudoClasses, validFor: identifier2 };
  if (isVariable(node) || (context.explicit || isDash) && isVarArg(node, state.doc))
    return {
      from: isVariable(node) || isDash ? node.from : pos,
      options: variableNames(state.doc, astTop(node), isVariable),
      validFor: variable
    };
  if (node.name == "TagName") {
    for (let { parent } = node; parent; parent = parent.parent)
      if (parent.name == "Block")
        return { from: node.from, options: properties(), validFor: identifier2 };
    return { from: node.from, options: tags2, validFor: identifier2 };
  }
  if (node.name == "AtKeyword")
    return { from: node.from, options: atRules, validFor: identifier2 };
  if (!context.explicit)
    return null;
  let above = node.resolve(pos), before = above.childBefore(pos);
  if (before && before.name == ":" && above.name == "PseudoClassSelector")
    return { from: pos, options: pseudoClasses, validFor: identifier2 };
  if (before && before.name == ":" && above.name == "Declaration" || above.name == "ArgList")
    return { from: pos, options: values, validFor: identifier2 };
  if (above.name == "Block" || above.name == "Styles")
    return { from: pos, options: properties(), validFor: identifier2 };
  return null;
};
var cssCompletionSource = /* @__PURE__ */ defineCSSCompletionSource((n) => n.name == "VariableName");
var cssLanguage = /* @__PURE__ */ import_language2.LRLanguage.define({
  name: "css",
  parser: /* @__PURE__ */ parser.configure({
    props: [
      /* @__PURE__ */ import_language2.indentNodeProp.add({
        Declaration: /* @__PURE__ */ (0, import_language2.continuedIndent)()
      }),
      /* @__PURE__ */ import_language2.foldNodeProp.add({
        "Block KeyframeList": import_language2.foldInside
      })
    ]
  }),
  languageData: {
    commentTokens: { block: { open: "/*", close: "*/" } },
    indentOnInput: /^\s*\}$/,
    wordChars: "-"
  }
});
function css2() {
  return new import_language2.LanguageSupport(cssLanguage, cssLanguage.data.of({ autocomplete: cssCompletionSource }));
}

// src/editor/extensions.ts
var import_language3 = __toModule(require("@codemirror/language"));
var import_state5 = __toModule(require("@codemirror/state"));
var import_view5 = __toModule(require("@codemirror/view"));
var import_autocomplete = __toModule(require("@codemirror/autocomplete"));
var import_search3 = __toModule(require("@codemirror/search"));
var import_lint = __toModule(require("@codemirror/lint"));
var basicSetup = [
  (0, import_view5.lineNumbers)(),
  (0, import_view5.highlightSpecialChars)(),
  (0, import_commands.history)(),
  css2(),
  (0, import_language3.foldGutter)(),
  (0, import_view5.drawSelection)(),
  (0, import_view5.dropCursor)(),
  import_state5.EditorState.allowMultipleSelections.of(true),
  (0, import_language3.indentOnInput)(),
  (0, import_language3.syntaxHighlighting)(import_language3.defaultHighlightStyle, { fallback: true }),
  import_view5.EditorView.lineWrapping,
  (0, import_language3.bracketMatching)(),
  (0, import_autocomplete.closeBrackets)(),
  (0, import_autocomplete.autocompletion)(),
  (0, import_view5.rectangularSelection)(),
  (0, import_search3.highlightSelectionMatches)(),
  import_view5.keymap.of([
    ...import_autocomplete.closeBracketsKeymap,
    ...import_commands.defaultKeymap,
    ...import_search3.searchKeymap,
    ...import_commands.historyKeymap,
    import_commands.indentWithTab,
    ...import_language3.foldKeymap,
    ...import_autocomplete.completionKeymap,
    ...import_lint.lintKeymap
  ])
].filter((ext) => ext);

// src/settings/export.ts
var import_obsidian2 = __toModule(require("obsidian"));
var ExportModal = class extends import_obsidian2.Modal {
  constructor(app, plugin, section, exportData) {
    super(app);
    this.plugin = plugin;
    this.exportData = exportData;
    this.section = section;
  }
  onOpen() {
    let { contentEl, modalEl } = this;
    modalEl.addClass("modal-style-settings");
    modalEl.addClass("modal-glimpse");
    new import_obsidian2.Setting(contentEl).setName(`\u5BFC\u51FA\u8BBE\u7F6E: ${this.section}`).then((setting) => {
      const output = JSON.stringify(this.exportData, null, 2);
      setting.controlEl.createEl("a", {
        cls: "style-settings-copy",
        text: "\u590D\u5236\u5230\u526A\u8D34\u677F",
        href: "#"
      }, (copyButton) => {
        new import_obsidian2.TextAreaComponent(contentEl).setValue(output).then((textarea) => {
          copyButton.addEventListener("click", (e) => {
            e.preventDefault();
            textarea.inputEl.select();
            textarea.inputEl.setSelectionRange(0, 99999);
            document.execCommand("copy");
            copyButton.addClass("success");
            setTimeout(() => {
              if (copyButton.parentNode) {
                copyButton.removeClass("success");
              }
            }, 2e3);
          });
        });
      });
      setting.controlEl.createEl("a", {
        cls: "style-settings-download",
        text: "\u4E0B\u8F7D",
        attr: {
          download: "glimpse.json",
          href: `data:application/json;charset=utf-8,${encodeURIComponent(output)}`
        }
      });
    });
  }
  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
};

// src/settings/import.ts
var import_ajv = __toModule(require_ajv());
var import_obsidian3 = __toModule(require("obsidian"));

// src/schema/queries.ts
var queriesSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  additionalProperties: {
    $ref: "#/definitions/SearchQuery"
  },
  definitions: {
    SearchQuery: {
      properties: {
        class: {
          type: "string"
        },
        color: {
          type: ["null", "string"]
        },
        css: {
          type: "string"
        },
        enabled: {
          type: "boolean"
        },
        group: {
          type: "string"
        },
        mark: {
          items: {
            enum: ["end", "group", "line", "match", "start"],
            type: "string"
          },
          type: "array"
        },
        query: {
          type: "string"
        },
        regex: {
          type: "boolean"
        }
      },
      required: ["class", "color", "query", "regex"],
      type: "object"
    }
  },
  type: "object"
};

// src/settings/import.ts
var ImportModal = class extends import_obsidian3.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    let { contentEl, modalEl } = this;
    modalEl.addClass("modal-style-settings");
    modalEl.addClass("modal-glimpse");
    new import_obsidian3.Setting(contentEl).setName("\u5BFC\u5165\u9AD8\u4EAE\u5668").setDesc("\u5BFC\u5165\u5B8C\u6574\u6216\u90E8\u5206\u914D\u7F6E\u3002\u8B66\u544A\uFF1A\u53EF\u80FD\u8986\u76D6\u73B0\u6709\u9AD8\u4EAE\u5668");
    new import_obsidian3.Setting(contentEl).then((setting) => {
      const errorSpan = createSpan({
        cls: "style-settings-import-error",
        text: "\u5BFC\u5165\u914D\u7F6E\u51FA\u9519"
      });
      setting.nameEl.appendChild(errorSpan);
      const importAndClose = async (str) => {
        var _a;
        if (str) {
          try {
            let { queries, queryOrder, groups } = this.plugin.settings.staticHighlighter;
            const imported = JSON.parse(str);
            const importedQueries = imported.queries || imported;
            const ajv = new import_ajv.default();
            const validate = ajv.compile(queriesSchema);
            if (!validate(importedQueries)) {
              throw (_a = validate.errors) == null ? void 0 : _a.map((err) => `${err.instancePath} ${err.message}`).first();
            }
            queries = Object.assign(queries, importedQueries);
            Object.keys(importedQueries).forEach((key) => queryOrder.includes(key) || queryOrder.push(key));
            if (!imported.groups) {
              Object.keys(importedQueries).forEach((key) => {
                delete queries[key].group;
              });
            }
            if (imported.groups) {
              imported.groups.forEach((g) => {
                if (!groups.includes(g))
                  groups.push(g);
              });
            }
            await this.plugin.saveSettings();
            this.plugin.updateStaticHighlighter();
            this.plugin.updateStyles();
            this.plugin.updateCustomCSS();
            this.plugin.settingsTab.display();
            this.close();
          } catch (e) {
            errorSpan.addClass("active");
            errorSpan.setText(`\u5BFC\u5165\u9AD8\u4EAE\u5668\u51FA\u9519: ${e}`);
          }
        } else {
          errorSpan.addClass("active");
          errorSpan.setText(`\u5BFC\u5165\u9AD8\u4EAE\u5668\u51FA\u9519: \u914D\u7F6E\u4E3A\u7A7A`);
        }
      };
      setting.controlEl.createEl("input", {
        cls: "style-settings-import-input",
        attr: {
          id: "style-settings-import-input",
          name: "style-settings-import-input",
          type: "file",
          accept: ".json"
        }
      }, (importInput) => {
        importInput.addEventListener("change", (e) => {
          const reader = new FileReader();
          reader.onload = async (e2) => {
            var _a;
            if ((_a = e2.target) == null ? void 0 : _a.result) {
              await importAndClose(e2.target && e2.target.result.toString().trim());
            }
          };
          let files = e.target.files;
          if (files == null ? void 0 : files.length)
            reader.readAsText(files[0]);
        });
      });
      setting.controlEl.createEl("label", {
        cls: "style-settings-import-label",
        text: "\u4ECE\u6587\u4EF6\u5BFC\u5165",
        attr: {
          for: "style-settings-import-input"
        }
      });
      new import_obsidian3.TextAreaComponent(contentEl).setPlaceholder("\u5728\u6B64\u7C98\u8D34\u914D\u7F6E...").then((ta) => {
        new import_obsidian3.ButtonComponent(contentEl).setButtonText("\u4FDD\u5B58").onClick(async () => {
          await importAndClose(ta.getValue().trim());
        });
      });
    });
  }
  onClose() {
    let { contentEl } = this;
    contentEl.empty();
  }
};

// src/editor/theme-dark.ts
var import_view6 = __toModule(require("@codemirror/view"));
var import_language4 = __toModule(require("@codemirror/language"));
var import_highlight2 = __toModule(require("@lezer/highlight"));
var ivory = "#abb2bf";
var stone = "#7d8799";
var invalid = "#ffffff";
var darkBackground = "#21252b";
var highlightBackground = "rgba(0, 0, 0, 0.5)";
var background = "#292d3e";
var tooltipBackground = "#353a42";
var selection = "rgba(128, 203, 196, 0.2)";
var cursor = "#ffcc00";
var materialPalenightTheme = import_view6.EditorView.theme({
  "&": {
    color: "#ffffff",
    backgroundColor: background
  },
  ".cm-content": {
    caretColor: cursor
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: cursor
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: selection
  },
  ".cm-panels": { backgroundColor: darkBackground, color: "#ffffff" },
  ".cm-panels.cm-panels-top": { borderBottom: "2px solid black" },
  ".cm-panels.cm-panels-bottom": { borderTop: "2px solid black" },
  ".cm-searchMatch": {
    backgroundColor: "#72a1ff59",
    outline: "1px solid #457dff"
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "#6199ff2f"
  },
  ".cm-activeLine": { backgroundColor: highlightBackground },
  ".cm-selectionMatch": { backgroundColor: "#aafe661a" },
  "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "#bad0f847",
    outline: "1px solid #515a6b"
  },
  ".cm-gutters": {
    background: "#292d3e",
    color: "#676e95",
    border: "none"
  },
  ".cm-activeLineGutter": {
    backgroundColor: highlightBackground
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "#ddd"
  },
  ".cm-tooltip": {
    border: "none",
    backgroundColor: tooltipBackground
  },
  ".cm-tooltip .cm-tooltip-arrow:before": {
    borderTopColor: "transparent",
    borderBottomColor: "transparent"
  },
  ".cm-tooltip .cm-tooltip-arrow:after": {
    borderTopColor: tooltipBackground,
    borderBottomColor: tooltipBackground
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: highlightBackground,
      color: ivory
    }
  }
}, { dark: true });
var materialPalenightHighlightStyle = import_language4.HighlightStyle.define([
  { tag: import_highlight2.tags.keyword, color: "#c792ea" },
  { tag: import_highlight2.tags.operator, color: "#89ddff" },
  { tag: import_highlight2.tags.special(import_highlight2.tags.variableName), color: "#eeffff" },
  { tag: import_highlight2.tags.typeName, color: "#f07178" },
  { tag: import_highlight2.tags.atom, color: "#f78c6c" },
  { tag: import_highlight2.tags.number, color: "#ff5370" },
  { tag: import_highlight2.tags.definition(import_highlight2.tags.variableName), color: "#82aaff" },
  { tag: import_highlight2.tags.string, color: "#c3e88d" },
  { tag: import_highlight2.tags.special(import_highlight2.tags.string), color: "#f07178" },
  { tag: import_highlight2.tags.comment, color: stone },
  { tag: import_highlight2.tags.variableName, color: "#f07178" },
  { tag: import_highlight2.tags.tagName, color: "#ff5370" },
  { tag: import_highlight2.tags.bracket, color: "#a2a1a4" },
  { tag: import_highlight2.tags.meta, color: "#ffcb6b" },
  { tag: import_highlight2.tags.attributeName, color: "#c792ea" },
  { tag: import_highlight2.tags.propertyName, color: "#c792ea" },
  { tag: import_highlight2.tags.className, color: "#decb6b" },
  { tag: import_highlight2.tags.invalid, color: invalid }
]);
var materialPalenight = [
  materialPalenightTheme,
  (0, import_language4.syntaxHighlighting)(materialPalenightHighlightStyle)
];

// src/editor/theme-light.ts
var import_view7 = __toModule(require("@codemirror/view"));
var import_language5 = __toModule(require("@codemirror/language"));
var import_highlight3 = __toModule(require("@lezer/highlight"));
var base00 = "#2e3440";
var base01 = "#3b4252";
var base02 = "#434c5e";
var base03 = "#4c566a";
var base05 = "#e5e9f0";
var base06 = "#eceff4";
var base07 = "#8fbcbb";
var base08 = "#88c0d0";
var base09 = "#81a1c1";
var base0A = "#5e81ac";
var base0b = "#bf616a";
var base0C = "#d08770";
var base0D = "#ebcb8b";
var base0E = "#a3be8c";
var base0F = "#b48ead";
var invalid2 = "#d30102";
var darkBackground2 = base06;
var highlightBackground2 = darkBackground2;
var background2 = "#ffffff";
var tooltipBackground2 = base01;
var selection2 = darkBackground2;
var cursor2 = base01;
var basicLightTheme = import_view7.EditorView.theme({
  "&": {
    color: base00,
    backgroundColor: background2
  },
  ".cm-content": {
    caretColor: cursor2
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: cursor2 },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: selection2
  },
  ".cm-panels": { backgroundColor: darkBackground2, color: base03 },
  ".cm-panels.cm-panels-top": { borderBottom: "2px solid black" },
  ".cm-panels.cm-panels-bottom": { borderTop: "2px solid black" },
  ".cm-searchMatch": {
    backgroundColor: "#72a1ff59",
    outline: `1px solid ${base03}`
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: base05
  },
  ".cm-activeLine": { backgroundColor: highlightBackground2 },
  ".cm-selectionMatch": { backgroundColor: base05 },
  "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    outline: `1px solid ${base03}`
  },
  "&.cm-focused .cm-matchingBracket": {
    backgroundColor: base06
  },
  ".cm-gutters": {
    backgroundColor: base06,
    color: base00,
    border: "none"
  },
  ".cm-activeLineGutter": {
    backgroundColor: highlightBackground2
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "transparent",
    border: "none",
    color: "#ddd"
  },
  ".cm-tooltip": {
    border: "none",
    backgroundColor: tooltipBackground2
  },
  ".cm-tooltip .cm-tooltip-arrow:before": {
    borderTopColor: "transparent",
    borderBottomColor: "transparent"
  },
  ".cm-tooltip .cm-tooltip-arrow:after": {
    borderTopColor: tooltipBackground2,
    borderBottomColor: tooltipBackground2
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li[aria-selected]": {
      backgroundColor: highlightBackground2,
      color: base03
    }
  }
}, { dark: false });
var basicLightHighlightStyle = import_language5.HighlightStyle.define([
  { tag: import_highlight3.tags.keyword, color: base0A },
  {
    tag: [import_highlight3.tags.name, import_highlight3.tags.deleted, import_highlight3.tags.character, import_highlight3.tags.propertyName, import_highlight3.tags.macroName],
    color: base0C
  },
  { tag: [import_highlight3.tags.variableName], color: base0C },
  { tag: [import_highlight3.tags.function(import_highlight3.tags.variableName)], color: base0A },
  { tag: [import_highlight3.tags.labelName], color: base09 },
  {
    tag: [import_highlight3.tags.color, import_highlight3.tags.constant(import_highlight3.tags.name), import_highlight3.tags.standard(import_highlight3.tags.name)],
    color: base0A
  },
  { tag: [import_highlight3.tags.definition(import_highlight3.tags.name), import_highlight3.tags.separator], color: base0E },
  { tag: [import_highlight3.tags.brace], color: base07 },
  {
    tag: [import_highlight3.tags.annotation],
    color: invalid2
  },
  {
    tag: [import_highlight3.tags.number, import_highlight3.tags.changed, import_highlight3.tags.annotation, import_highlight3.tags.modifier, import_highlight3.tags.self, import_highlight3.tags.namespace],
    color: base08
  },
  {
    tag: [import_highlight3.tags.typeName, import_highlight3.tags.className],
    color: base0D
  },
  {
    tag: [import_highlight3.tags.operator, import_highlight3.tags.operatorKeyword],
    color: base0E
  },
  {
    tag: [import_highlight3.tags.tagName],
    color: base0F
  },
  {
    tag: [import_highlight3.tags.squareBracket],
    color: base0b
  },
  {
    tag: [import_highlight3.tags.angleBracket],
    color: base0C
  },
  {
    tag: [import_highlight3.tags.attributeName],
    color: base0D
  },
  {
    tag: [import_highlight3.tags.regexp],
    color: base0A
  },
  {
    tag: [import_highlight3.tags.quote],
    color: base01
  },
  { tag: [import_highlight3.tags.string], color: base0C },
  {
    tag: import_highlight3.tags.link,
    color: base07,
    textDecoration: "underline",
    textUnderlinePosition: "under"
  },
  {
    tag: [import_highlight3.tags.url, import_highlight3.tags.escape, import_highlight3.tags.special(import_highlight3.tags.string)],
    color: base0C
  },
  { tag: [import_highlight3.tags.meta], color: base08 },
  { tag: [import_highlight3.tags.comment], color: base02, fontStyle: "italic" },
  { tag: import_highlight3.tags.strong, fontWeight: "bold", color: base0A },
  { tag: import_highlight3.tags.emphasis, fontStyle: "italic", color: base0A },
  { tag: import_highlight3.tags.strikethrough, textDecoration: "line-through" },
  { tag: import_highlight3.tags.heading, fontWeight: "bold", color: base0A },
  { tag: import_highlight3.tags.special(import_highlight3.tags.heading1), fontWeight: "bold", color: base0A },
  { tag: import_highlight3.tags.heading1, fontWeight: "bold", color: base0A },
  {
    tag: [import_highlight3.tags.heading2, import_highlight3.tags.heading3, import_highlight3.tags.heading4],
    fontWeight: "bold",
    color: base0A
  },
  {
    tag: [import_highlight3.tags.heading5, import_highlight3.tags.heading6],
    color: base0A
  },
  { tag: [import_highlight3.tags.atom, import_highlight3.tags.bool, import_highlight3.tags.special(import_highlight3.tags.variableName)], color: base0C },
  {
    tag: [import_highlight3.tags.processingInstruction, import_highlight3.tags.inserted],
    color: base07
  },
  {
    tag: [import_highlight3.tags.contentSeparator],
    color: base0D
  },
  { tag: import_highlight3.tags.invalid, color: base02, borderBottom: `1px dotted ${invalid2}` }
]);
var basicLight = [basicLightTheme, (0, import_language5.syntaxHighlighting)(basicLightHighlightStyle)];

// src/settings/ui.ts
var SettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.activeGroup = "\u9ED8\u8BA4";
    this.activeMainTab = "persistent";
    this.plugin = plugin;
  }
  hide() {
    var _a;
    (_a = this.editor) == null ? void 0 : _a.destroy();
    this.pickrInstance && this.pickrInstance.destroyAndRemove();
  }
  display() {
    var _a;
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("glimpse-settings");
    const mainTabBarEl = containerEl.createDiv({ cls: "glimpse-main-tab-bar" });
    const persistentTab = mainTabBarEl.createEl("span", { cls: "glimpse-main-tab", text: "\u6301\u4E45\u9AD8\u4EAE" });
    const selectionTab = mainTabBarEl.createEl("span", { cls: "glimpse-main-tab", text: "\u9009\u62E9\u9AD8\u4EAE" });
    if (this.activeMainTab === "persistent")
      persistentTab.addClass("active");
    else
      selectionTab.addClass("active");
    persistentTab.addEventListener("click", () => {
      this.activeMainTab = "persistent";
      this.display();
    });
    selectionTab.addEventListener("click", () => {
      this.activeMainTab = "selection";
      this.display();
    });
    const persistentContent = containerEl.createDiv({ cls: "glimpse-tab-content" });
    if (this.activeMainTab !== "persistent")
      persistentContent.style.display = "none";
    const config = this.plugin.settings.staticHighlighter;
    const defineQueryUI = new import_obsidian4.Setting(persistentContent);
    defineQueryUI.setName("\u5B9A\u4E49\u6301\u4E45\u9AD8\u4EAE\u5668").setClass("highlighter-definition").setDesc("\u5728\u6B64\u5904\u5B9A\u4E49\u9AD8\u4EAE\u5668\u540D\u79F0\u3001\u80CC\u666F\u8272\u548C\u641C\u7D22\u8BCD/\u8868\u8FBE\u5F0F\u3002\u8F93\u5165\u6B63\u5219\u67E5\u8BE2\u65F6\u8BF7\u542F\u7528\u6B63\u5219\u5F00\u5173\u3002\u5B9A\u4E49\u5B8C\u6210\u540E\u8BB0\u5F97\u70B9\u51FB\u4FDD\u5B58\u6309\u94AE\u3002");
    const classInput = new import_obsidian4.TextComponent(defineQueryUI.controlEl);
    classInput.setPlaceholder("\u9AD8\u4EAE\u5668\u540D\u79F0");
    classInput.inputEl.ariaLabel = "\u9AD8\u4EAE\u5668\u540D\u79F0";
    classInput.inputEl.addClass("highlighter-name");
    const colorWrapper = defineQueryUI.controlEl.createDiv("color-wrapper");
    let pickrInstance;
    const colorPicker = new import_obsidian4.ButtonComponent(colorWrapper);
    colorPicker.setClass("highlightr-color-picker").then(() => {
      this.pickrInstance = pickrInstance = new import_pickr.default({
        el: colorPicker.buttonEl,
        container: colorWrapper,
        theme: "nano",
        defaultRepresentation: "HEXA",
        default: "#42188038",
        comparison: false,
        components: {
          preview: true,
          opacity: true,
          hue: true,
          interaction: { hex: true, rgba: false, hsla: true, hsva: false, cmyk: false, input: true, clear: true, cancel: true, save: true }
        }
      });
      colorWrapper.querySelector(".pcr-button").ariaLabel = "Background color picker";
      pickrInstance.on("clear", (instance) => {
        instance.hide();
        classInput.inputEl.style.removeProperty("--picker-bg");
        classInput.inputEl.style.removeProperty("color");
      }).on("cancel", (instance) => instance.hide()).on("change", (color) => {
        const colorHex = (color == null ? void 0 : color.toHEXA().toString()) || "";
        const newColor = colorHex && colorHex.length === 6 ? `${colorHex}A6` : colorHex;
        classInput.inputEl.style.setProperty("--picker-bg", newColor);
        classInput.inputEl.style.setProperty("color", "var(--text-normal)");
      }).on("save", (color, instance) => instance.hide());
    });
    const queryWrapper = defineQueryUI.controlEl.createDiv("query-wrapper");
    const queryInput = new import_obsidian4.TextComponent(queryWrapper);
    queryInput.setPlaceholder("\u641C\u7D22\u8BCD");
    queryInput.inputEl.addClass("highlighter-settings-query");
    const queryTypeInput = new import_obsidian4.ToggleComponent(queryWrapper);
    queryTypeInput.toggleEl.addClass("highlighter-settings-regex");
    queryTypeInput.toggleEl.ariaLabel = "\u542F\u7528\u6B63\u5219";
    const marksWrapper = defineQueryUI.controlEl.createDiv({ cls: "mark-wrapper" });
    const marks = {};
    const toggleLabels = { match: "\u5339\u914D", line: "\u7236\u884C", start: "\u5F00\u59CB", end: "\u7ED3\u675F", group: "\u6355\u83B7\u7EC4" };
    Object.entries(toggleLabels).forEach(([key, label]) => {
      const item = marksWrapper.createDiv();
      item.createSpan({ text: label });
      const toggle = new import_obsidian4.ToggleComponent(item);
      toggle.setValue(key === "match");
      marks[key] = { container: item, toggle };
    });
    queryTypeInput.onChange((value) => {
      var _a2;
      queryInput.setPlaceholder(value ? "\u641C\u7D22\u8868\u8FBE\u5F0F" : "\u641C\u7D22\u8BCD");
      const gw = (_a2 = marks["group"]) == null ? void 0 : _a2.container;
      if (gw)
        gw.style.visibility = value ? "" : "hidden";
    });
    {
      const gw = (_a = marks["group"]) == null ? void 0 : _a.container;
      if (gw)
        gw.style.visibility = "hidden";
    }
    const customCSSWrapper = defineQueryUI.controlEl.createDiv("custom-css-wrapper");
    customCSSWrapper.createSpan("setting-item-name").setText("\u81EA\u5B9A\u4E49 CSS");
    const customCSSEl = new import_obsidian4.TextAreaComponent(customCSSWrapper);
    this.editor = editorFromTextArea(customCSSEl.inputEl, basicSetup);
    customCSSEl.inputEl.addClass("custom-css");
    const importBtn = new import_obsidian4.ButtonComponent(queryWrapper);
    importBtn.setClass("action-button").setClass("action-button-save").setClass("mod-cta").setIcon("clipboard-copy").setTooltip("\u4ECE\u526A\u8D34\u677F\u5BFC\u5165").onClick(async () => {
      var _a2;
      try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);
        const entry = Object.entries((data == null ? void 0 : data.queries) || {})[0];
        if (!entry) {
          new import_obsidian4.Notice("\u526A\u8D34\u677F\u6570\u636E\u683C\u5F0F\u65E0\u6548");
          return;
        }
        const [name, opts] = entry;
        classInput.inputEl.value = name;
        if (opts.color)
          pickrInstance.setColor(opts.color);
        queryInput.inputEl.value = opts.query || "";
        queryTypeInput.setValue(!!opts.regex);
        Object.entries(marks).forEach(([key, m]) => {
          var _a3, _b;
          m.toggle.setValue((_b = (_a3 = opts.mark) == null ? void 0 : _a3.includes(key)) != null ? _b : false);
        });
        const extensions = [...basicSetup];
        if (document.body.hasClass("theme-dark")) {
          extensions.push(materialPalenight);
        } else {
          extensions.push(basicLightTheme);
        }
        this.editor.setState(import_state6.EditorState.create({
          doc: (_a2 = opts.css) != null ? _a2 : "",
          extensions
        }));
        new import_obsidian4.Notice(`\u5DF2\u5BFC\u5165: ${name}`);
      } catch (e) {
        new import_obsidian4.Notice("\u526A\u8D34\u677F\u8BFB\u53D6\u6216\u89E3\u6790\u5931\u8D25");
      }
    });
    const saveButton = new import_obsidian4.ButtonComponent(queryWrapper);
    saveButton.setClass("action-button").setClass("action-button-save").setClass("mod-cta").setIcon("save").setTooltip("\u4FDD\u5B58").onClick(async (buttonEl) => {
      var _a2;
      const className = classInput.inputEl.value.replace(/ /g, "-");
      const hexValue = (_a2 = pickrInstance.getSelectedColor()) == null ? void 0 : _a2.toHEXA().toString();
      const queryValue = queryInput.inputEl.value;
      const queryTypeValue = queryTypeInput.getValue();
      const customCss = this.editor.state.doc.toString();
      const enabledMarks = Object.entries(marks).filter(([, m]) => m.toggle.getValue()).map(([k]) => k);
      if (className) {
        if (!config.queryOrder.includes(className)) {
          config.queryOrder.push(className);
        }
        config.queries[className] = {
          class: className,
          color: hexValue != null ? hexValue : "",
          regex: queryTypeValue,
          query: queryValue,
          mark: enabledMarks,
          css: customCss,
          group: this.activeGroup === "\u9ED8\u8BA4" ? void 0 : this.activeGroup
        };
        await this.plugin.saveSettings();
        this.plugin.updateStaticHighlighter();
        this.plugin.updateCustomCSS();
        this.plugin.updateStyles();
        this.display();
      } else if (className && !hexValue) {
        new import_obsidian4.Notice("\u7F3A\u5C11\u9AD8\u4EAE\u5668\u989C\u8272\u503C");
      } else if (!className && hexValue) {
        new import_obsidian4.Notice("\u7F3A\u5C11\u9AD8\u4EAE\u5668\u540D\u79F0");
      } else if (!/^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(className)) {
        new import_obsidian4.Notice("\u7F3A\u5C11\u9AD8\u4EAE\u5668\u540D\u79F0");
      } else {
        new import_obsidian4.Notice("\u7F3A\u5C11\u9AD8\u4EAE\u5668\u8BBE\u7F6E\u503C");
      }
    });
    const toolbarEl = persistentContent.createDiv({ cls: "glimpse-toolbar" });
    const allMatchOn = config.queryOrder.every((h) => {
      var _a2, _b, _c;
      return (_c = (_b = (_a2 = config.queries[h]) == null ? void 0 : _a2.mark) == null ? void 0 : _b.includes("match")) != null ? _c : true;
    });
    new import_obsidian4.ButtonComponent(toolbarEl).setClass("action-button").setButtonText(allMatchOn ? "\u5168\u90E8\u7981\u6B62" : "\u5168\u90E8\u542F\u7528").onClick(async () => {
      const newVal = !allMatchOn;
      config.queryOrder.forEach((h) => {
        var _a2;
        const q = config.queries[h];
        if (newVal) {
          q.mark = [...q.mark || [], "match"];
        } else {
          q.mark = ((_a2 = q.mark) == null ? void 0 : _a2.filter((m) => m !== "match")) || [];
        }
      });
      await this.plugin.saveSettings();
      this.plugin.updateStaticHighlighter();
      this.plugin.updateStyles();
      this.display();
    });
    new import_obsidian4.ButtonComponent(toolbarEl).setClass("action-button").setButtonText("\u4E00\u952E\u5BFC\u5165").onClick(() => {
      new ImportModal(this.plugin.app, this.plugin).open();
    });
    new import_obsidian4.ButtonComponent(toolbarEl).setClass("action-button").setButtonText("\u4E00\u952E\u5BFC\u51FA").onClick(() => {
      new ExportModal(this.plugin.app, this.plugin, "\u5168\u90E8", {
        queries: config.queries,
        groups: config.groups
      }).open();
    });
    const groupTabEl = persistentContent.createDiv({ cls: "glimpse-group-tabs" });
    const tabBarEl = groupTabEl.createDiv({ cls: "glimpse-group-tab-bar" });
    const allGroups = ["\u9ED8\u8BA4", ...config.groups || []];
    allGroups.forEach((g) => {
      const tabEl = tabBarEl.createEl("span", { cls: "glimpse-group-tab", text: g });
      if (g === this.activeGroup)
        tabEl.addClass("active");
      tabEl.addEventListener("click", () => {
        this.activeGroup = g;
        this.display();
      });
      tabEl.addEventListener("dragover", (e) => {
        if (!this._dragItemId)
          return;
        e.preventDefault();
        tabEl.addClass("drag-hover");
      });
      tabEl.addEventListener("dragleave", () => {
        tabEl.removeClass("drag-hover");
      });
      tabEl.addEventListener("drop", (e) => {
        e.preventDefault();
        tabEl.removeClass("drag-hover");
        if (!this._dragItemId || g === this.activeGroup)
          return;
        const draggedId = this._dragItemId;
        this._dragItemId = void 0;
        if (!config.queries[draggedId])
          return;
        config.queries[draggedId].group = g === "\u9ED8\u8BA4" ? void 0 : g;
        this.activeGroup = g;
        this.plugin.saveSettings();
        this.display();
      });
    });
    const groupActionsEl = groupTabEl.createDiv({ cls: "glimpse-group-actions" });
    const addGroupBtn = new import_obsidian4.ButtonComponent(groupActionsEl);
    addGroupBtn.setIcon("plus").setClass("clickable-icon").setTooltip("\u65B0\u5EFA\u5206\u7EC4").onClick(() => {
      const modal = new import_obsidian4.Modal(this.app);
      modal.titleEl.setText("\u65B0\u5EFA\u5206\u7EC4");
      const input = new import_obsidian4.TextComponent(modal.contentEl);
      input.inputEl.addClass("glimpse-modal-input");
      input.setPlaceholder("\u8F93\u5165\u5206\u7EC4\u540D\u79F0");
      input.inputEl.focus();
      new import_obsidian4.Setting(modal.contentEl).addButton((b) => b.setButtonText("\u53D6\u6D88").onClick(() => {
        modal.close();
      })).addButton((b) => b.setButtonText("\u786E\u8BA4").setClass("mod-cta").onClick(() => {
        const name = input.getValue().trim();
        if (!name) {
          new import_obsidian4.Notice("\u5206\u7EC4\u540D\u4E0D\u80FD\u4E3A\u7A7A");
          return;
        }
        if (["\u9ED8\u8BA4", ...config.groups || []].includes(name)) {
          new import_obsidian4.Notice("\u5206\u7EC4\u540D\u5DF2\u5B58\u5728");
          return;
        }
        if (!config.groups)
          config.groups = [];
        config.groups.push(name);
        this.activeGroup = name;
        this.plugin.saveSettings();
        this.display();
        modal.close();
      }));
      modal.open();
    });
    const renameGroupBtn = new import_obsidian4.ButtonComponent(groupActionsEl);
    renameGroupBtn.setIcon("folder-pen").setClass("clickable-icon").setTooltip("\u91CD\u547D\u540D\u5206\u7EC4").onClick(() => {
      if (this.activeGroup === "\u9ED8\u8BA4")
        return;
      const modal = new import_obsidian4.Modal(this.app);
      modal.titleEl.setText(`\u91CD\u547D\u540D\u5206\u7EC4"${this.activeGroup}"`);
      const input = new import_obsidian4.TextComponent(modal.contentEl);
      input.inputEl.addClass("glimpse-modal-input");
      input.setValue(this.activeGroup);
      input.inputEl.focus();
      input.inputEl.select();
      new import_obsidian4.Setting(modal.contentEl).addButton((b) => b.setButtonText("\u53D6\u6D88").onClick(() => {
        modal.close();
      })).addButton((b) => b.setButtonText("\u786E\u8BA4").setClass("mod-cta").onClick(() => {
        var _a2;
        const newName = input.getValue().trim();
        if (!newName || newName === this.activeGroup) {
          modal.close();
          return;
        }
        if (["\u9ED8\u8BA4", ...config.groups || []].includes(newName)) {
          new import_obsidian4.Notice("\u5206\u7EC4\u540D\u5DF2\u5B58\u5728");
          return;
        }
        config.queryOrder.forEach((h) => {
          var _a3;
          if (((_a3 = config.queries[h]) == null ? void 0 : _a3.group) === this.activeGroup)
            config.queries[h].group = newName;
        });
        const idx = (_a2 = config.groups) == null ? void 0 : _a2.indexOf(this.activeGroup);
        if (idx !== void 0 && idx > -1)
          config.groups[idx] = newName;
        this.activeGroup = newName;
        this.plugin.saveSettings();
        this.display();
        modal.close();
      }));
      modal.open();
    });
    const delGroupBtn = new import_obsidian4.ButtonComponent(groupActionsEl);
    delGroupBtn.setIcon("delete").setClass("clickable-icon").onClick(async () => {
      var _a2, _b;
      if (this.activeGroup === "\u9ED8\u8BA4")
        return;
      const groupHighlighters = config.queryOrder.filter((h) => {
        var _a3;
        return ((_a3 = config.queries[h]) == null ? void 0 : _a3.group) === this.activeGroup;
      });
      if (groupHighlighters.length > 0) {
        const confirmed = await new Promise((resolve) => {
          const confirmModal = new import_obsidian4.Modal(this.app);
          confirmModal.contentEl.createEl("p", { text: `\u786E\u5B9A\u5220\u9664\u5206\u7EC4"${this.activeGroup}"\uFF1F\u8BE5\u7EC4\u5305\u542B ${groupHighlighters.length} \u4E2A\u9AD8\u4EAE\u5668\u3002` });
          new import_obsidian4.Setting(confirmModal.contentEl).addButton((b) => b.setButtonText("\u53D6\u6D88").onClick(() => {
            confirmModal.close();
            resolve(false);
          })).addButton((b) => b.setButtonText("\u5220\u9664").setClass("mod-warning").onClick(() => {
            confirmModal.close();
            resolve(true);
          }));
          confirmModal.open();
        });
        if (!confirmed)
          return;
      }
      const idx = (_a2 = config.groups) == null ? void 0 : _a2.indexOf(this.activeGroup);
      if (idx !== void 0 && idx > -1)
        (_b = config.groups) == null ? void 0 : _b.splice(idx, 1);
      this.activeGroup = "\u9ED8\u8BA4";
      await this.plugin.saveSettings();
      this.display();
    });
    const highlightersContainer = persistentContent.createEl("div", { cls: "highlighter-container" });
    const filteredOrder = config.queryOrder.filter((h) => {
      const q = config.queries[h];
      if (this.activeGroup === "\u9ED8\u8BA4")
        return !q.group || q.group === "\u9ED8\u8BA4";
      return q.group === this.activeGroup;
    });
    filteredOrder.forEach((highlighter) => {
      var _a2, _b;
      const { query, regex, mark } = config.queries[highlighter];
      const color = config.queries[highlighter].color;
      const settingItem = highlightersContainer.createEl("div");
      settingItem.id = "dh-" + highlighter;
      settingItem.draggable = true;
      settingItem.addEventListener("dragstart", () => {
        this._dragItemId = highlighter;
      });
      settingItem.addEventListener("dragend", () => {
        this._dragItemId = void 0;
      });
      const desc = [];
      desc.push((regex ? "\u641C\u7D22\u8868\u8FBE\u5F0F: " : "\u641C\u7D22\u8BCD: ") + query);
      const setting = new import_obsidian4.Setting(settingItem).setClass("highlighter-details").setName(highlighter).setDesc(desc.join(" | "));
      const dragIcon = setting.settingEl.createEl("span");
      dragIcon.addClass("highlighter-setting-icon-drag");
      (0, import_obsidian4.setIcon)(dragIcon, "grip-vertical");
      dragIcon.ariaLabel = "\u62D6\u52A8\u6392\u5E8F";
      setting.settingEl.prepend(dragIcon);
      const colorIcon = setting.settingEl.createEl("span");
      colorIcon.addClass("highlighter-style-preview");
      colorIcon.textContent = "\u9884\u89C8";
      let previewStyles = "";
      if (color)
        previewStyles += `background-color: ${color}; `;
      const customCss = config.queries[highlighter].css;
      if (customCss) {
        const blockMatch = customCss.match(/\{([^}]+)\}/);
        previewStyles += blockMatch ? blockMatch[1] : customCss;
      }
      if (previewStyles)
        colorIcon.setAttribute("style", previewStyles + " width: auto;");
      setting.settingEl.insertBefore(colorIcon, dragIcon.nextSibling);
      setting.addButton((button) => {
        button.setClass("clickable-icon").setClass("action-button-edit").setIcon("pencil").setTooltip("\u7F16\u8F91").onClick(async (evt) => {
          var _a3;
          const options = config.queries[highlighter];
          classInput.inputEl.value = highlighter;
          pickrInstance.setColor(options.color);
          queryInput.inputEl.value = options.query;
          pickrInstance.setColor(options.color);
          queryTypeInput.setValue(options.regex);
          Object.entries(marks).forEach(([key, m]) => {
            var _a4, _b2;
            m.toggle.setValue((_b2 = (_a4 = options.mark) == null ? void 0 : _a4.includes(key)) != null ? _b2 : true);
          });
          const extensions = basicSetup;
          if (document.body.hasClass("theme-dark")) {
            extensions.push(materialPalenight);
          } else {
            extensions.push(basicLightTheme);
          }
          this.editor.setState(import_state6.EditorState.create({ doc: (_a3 = options.css) != null ? _a3 : "", extensions }));
          containerEl.scrollTop = 0;
        });
      }).addButton((button) => {
        button.setClass("clickable-icon").setIcon("clipboard-paste").setTooltip("\u5BFC\u51FA").onClick(() => {
          const data = { queries: { [highlighter]: config.queries[highlighter] }, groups: [] };
          new ExportModal(this.plugin.app, this.plugin, highlighter, data).open();
        });
      }).addButton((button) => {
        button.setClass("clickable-icon").setClass("action-button-delete").setIcon("trash").setTooltip("\u5220\u9664").onClick(async () => {
          new import_obsidian4.Notice(`${highlighter} \u9AD8\u4EAE\u5DF2\u5220\u9664`);
          delete config.queries[highlighter];
          config.queryOrder.remove(highlighter);
          await this.plugin.saveSettings();
          this.plugin.updateStyles();
          this.plugin.updateStaticHighlighter();
          highlightersContainer.querySelector(`#dh-${highlighter}`).detach();
        });
      });
      const matchWrapper = setting.controlEl.createDiv({ cls: "match-toggle-wrapper" });
      new import_obsidian4.ToggleComponent(matchWrapper).setValue((_a2 = mark == null ? void 0 : mark.includes("match")) != null ? _a2 : true).onChange(async (val) => {
        var _a3;
        const options = config.queries[highlighter];
        if (val) {
          options.mark = [...options.mark || [], "match"];
        } else {
          options.mark = ((_a3 = options.mark) == null ? void 0 : _a3.filter((m) => m !== "match")) || [];
        }
        setting.settingEl.toggleClass("match-disabled", !val);
        await this.plugin.saveSettings();
        this.plugin.updateStaticHighlighter();
        this.plugin.updateStyles();
      });
      if (!((_b = mark == null ? void 0 : mark.includes("match")) != null ? _b : true))
        setting.settingEl.addClass("match-disabled");
    });
    const sortableEl = sortable_esm_default.create(highlightersContainer, {
      animation: 500,
      ghostClass: "highlighter-sortable-ghost",
      chosenClass: "highlighter-sortable-chosen",
      dragClass: "highlighter-sortable-drag",
      handle: ".highlighter-setting-icon-drag",
      dragoverBubble: true,
      fallbackClass: "highlighter-sortable-fallback",
      easing: "cubic-bezier(1, 0, 0, 1)",
      onSort: async (command) => {
        const items = highlightersContainer.querySelectorAll('[id^="dh-"]');
        const domOrder = Array.from(items).map((el) => el.id.replace("dh-", ""));
        const nonFiltered = config.queryOrder.filter((h) => !domOrder.includes(h));
        config.queryOrder = [...domOrder, ...nonFiltered];
        this.plugin.settings.staticHighlighter.queryOrder = config.queryOrder;
        await this.plugin.saveSettings();
      }
    });
    const selectionContent = containerEl.createDiv({ cls: "glimpse-tab-content" });
    if (this.activeMainTab !== "selection")
      selectionContent.style.display = "none";
    new import_obsidian4.Setting(selectionContent).setName("\u9AD8\u4EAE\u5F53\u524D\u9009\u4E2D\u6587\u672C\u7684\u6240\u6709\u51FA\u73B0\u4F4D\u7F6E").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.selectionHighlighter.highlightSelectedText).onChange((value) => {
        this.plugin.settings.selectionHighlighter.highlightSelectedText = value;
        this.plugin.saveSettings();
        this.plugin.updateSelectionHighlighter();
      });
    });
    new import_obsidian4.Setting(selectionContent).setName("\u9AD8\u4EAE\u5EF6\u8FDF").setDesc("\u9AD8\u4EAE\u51FA\u73B0\u7684\u5EF6\u8FDF\u65F6\u95F4\uFF08\u6BEB\u79D2\uFF09\uFF0C\u9700\u5927\u4E8E 200ms").addText((text) => {
      text.inputEl.type = "number";
      text.setValue(String(this.plugin.settings.selectionHighlighter.highlightDelay)).onChange((value) => {
        if (parseInt(value) < 200)
          value = "200";
        if (parseInt(value) >= 0)
          this.plugin.settings.selectionHighlighter.highlightDelay = parseInt(value);
        this.plugin.saveSettings();
        this.plugin.updateSelectionHighlighter();
      });
    });
    new import_obsidian4.Setting(selectionContent).setName("\u7F29\u7565\u56FE").setDesc("\u5728\u7F16\u8F91\u5668\u53F3\u4FA7\u663E\u793A\u7F29\u7565\u56FE\uFF08\u7C7B\u4F3C VS Code minimap\uFF09\uFF0C\u53EF\u62D6\u52A8\u6ED1\u5757\u6EDA\u52A8\u6587\u6863").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.selectionHighlighter.minimapEnabled).onChange(async (value) => {
        this.plugin.settings.selectionHighlighter.minimapEnabled = value;
        await this.plugin.saveSettings();
        this.plugin.updateSelectionHighlighter();
      });
    });
  }
};
function editorFromTextArea(textarea, extensions) {
  const view = new import_view8.EditorView({
    state: import_state6.EditorState.create({ doc: textarea.value, extensions })
  });
  textarea.parentNode.insertBefore(view.dom, textarea);
  textarea.style.display = "none";
  if (textarea.form)
    textarea.form.addEventListener("submit", () => {
      textarea.value = view.state.doc.toString();
    });
  return view;
}

// src/main.ts
var GlimpsePlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.updateConfig = (0, import_obsidian5.debounce)((type, config) => {
      if (type !== "selection")
        return;
      this.iterateCM6((view) => {
        view.dispatch({
          effects: reconfigureSelectionHighlighter(config)
        });
      });
    }, 1e3, true);
  }
  async onload() {
    await this.loadSettings();
    this.settingsTab = new SettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions = [];
    this.updateSelectionHighlighter();
    this.updateMinimap();
    this.extensions.push(scrollbarMarkersExtension());
    this.updateStaticHighlighter();
    this.updateStyles();
    this.registerEditorExtension(this.extensions);
    this.initCSS();
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    let changed = false;
    if (this.settings.selectionHighlighter.minSelectionLength !== DEFAULT_SETTINGS.selectionHighlighter.minSelectionLength) {
      this.settings.selectionHighlighter.minSelectionLength = DEFAULT_SETTINGS.selectionHighlighter.minSelectionLength;
      changed = true;
    }
    if (this.settings.selectionHighlighter.maxMatches !== DEFAULT_SETTINGS.selectionHighlighter.maxMatches) {
      this.settings.selectionHighlighter.maxMatches = DEFAULT_SETTINGS.selectionHighlighter.maxMatches;
      changed = true;
    }
    if (this.settings.selectionHighlighter.highlightDelay < 200) {
      this.settings.selectionHighlighter.highlightDelay = 200;
      changed = true;
    }
    if (changed)
      await this.saveSettings();
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  initCSS() {
    const styleEl = this.styleEl = document.createElement("style");
    styleEl.setAttribute("type", "text/css");
    document.head.appendChild(styleEl);
    this.register(() => styleEl.detach());
    this.updateCustomCSS();
  }
  updateCustomCSS() {
    this.styleEl.textContent = Object.values(this.settings.staticHighlighter.queries).map((q) => q && q.css).join("\n");
    this.app.workspace.trigger("css-change");
  }
  updateStyles() {
    this.extensions.remove(this.styles);
    this.styles = buildStyles(this);
    this.extensions.push(this.styles);
    this.app.workspace.updateOptions();
  }
  updateStaticHighlighter() {
    this.extensions.remove(this.staticHighlighter);
    this.staticHighlighter = staticHighlighterExtension(this);
    this.extensions.push(this.staticHighlighter);
    this.app.workspace.updateOptions();
  }
  updateSelectionHighlighter() {
    this.extensions.remove(this.selectionHighlighter);
    this.selectionHighlighter = highlightSelectionMatches(this.settings.selectionHighlighter);
    this.extensions.push(this.selectionHighlighter);
    this.updateMinimap();
    this.app.workspace.updateOptions();
  }
  updateMinimap() {
    this.extensions.remove(this.minimapExtension);
    if (this.settings.selectionHighlighter.minimapEnabled) {
      this.minimapExtension = minimapExtension({ enabled: true, width: 80 });
      this.extensions.push(this.minimapExtension);
    }
  }
  iterateCM6(callback) {
    this.app.workspace.iterateAllLeaves((leaf) => {
      var _a;
      (leaf == null ? void 0 : leaf.view) instanceof import_obsidian5.MarkdownView && ((_a = leaf.view.editor) == null ? void 0 : _a.cm) instanceof import_view9.EditorView && callback(leaf.view.editor.cm);
    });
  }
};
/*!
Copyright 2019 Ron Buckton

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
/*! Pickr 1.8.4 MIT | https://github.com/Simonwep/pickr */
/**!
 * Sortable 1.15.7
 * @author	RubaXa   <trash@rubaxa.org>
 * @author	owenm    <owen23355@gmail.com>
 * @license MIT
 */
