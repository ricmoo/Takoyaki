"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var SvgNode = /** @class */ (function () {
    function SvgNode(name, attributes, selfClose) {
        var _this = this;
        this.name = name;
        this.attributes = {};
        this.selfClose = selfClose;
        this.children = [];
        this._parentNode = null;
        // Populate the attributes
        if (typeof (attributes) === "string") {
            var replacer = function (all, key, value) {
                _this.attributes[key] = value.replace(/\s+/g, " ");
                return "";
            };
            attributes = (attributes || "").replace(/([a-z:]+)\s*=\s*"(([^"]|\\.)*)"/ig, replacer);
            // Check for unprocessed attributes
            if (attributes.trim().length) {
                throw new Error("Junk attributes leftover: " + JSON.stringify(attributes));
            }
        }
        else if (attributes) {
            Object.keys(attributes).forEach(function (key) {
                _this.attributes[key] = attributes[key];
            });
        }
        ///Object.freeze(this.attributes);
        ///Object.freeze(this.children);
        //Object.freeze(this);
    }
    SvgNode.prototype.render = function () {
        var _this = this;
        var result = "<" + this.name;
        result += Object.keys(this.attributes).map(function (key) { return " " + key + "=\"" + _this.attributes[key] + "\""; }).join("");
        // Self-closing tag; just close it and we're done
        if (this.selfClose) {
            return result + " />";
        }
        // Can have children; add them and include a closing tag
        result += ">";
        result += this.children.map(function (child) { return child.render(); }).join("");
        result += "</" + this.name + ">";
        return result;
    };
    SvgNode.prototype.clone = function () {
        var node = new SvgNode(this.name, this.attributes, this.selfClose);
        this.children.forEach(function (child) {
            node.children.push(child.clone());
        });
        return node;
    };
    SvgNode.prototype.remove = function () {
        var _this = this;
        var node = (this._parentNode);
        node.children = node.children.filter(function (child) { return (child !== _this); });
    };
    SvgNode.isNode = function (value) {
        return (value instanceof Node);
    };
    return SvgNode;
}());
exports.SvgNode = SvgNode;
var Data = /** @class */ (function () {
    function Data(content) {
        this.content = content;
        this._parentNode = null;
    }
    Data.prototype.render = function () {
        return this.content;
    };
    Data.prototype.clone = function () {
        return new Data(this.content);
    };
    return Data;
}());
exports.Data = Data;
var SvgDocument = /** @class */ (function () {
    function SvgDocument(definition, svg) {
        var _this = this;
        this.definition = definition;
        this.svg = svg;
        this._links = {};
        var visit = function (node) {
            (node.children || []).forEach(function (child) {
                child._parentNode = node;
                visit(child);
            });
            if (node.attributes == null) {
                return;
            }
            var id = node.attributes["id"];
            if (id == null) {
                return;
            }
            if (_this._links[id] == null) {
                _this._links[id] = [node];
            }
            else {
                _this._links[id].push(node);
            }
        };
        visit(this.svg);
        this.svg._parentNode = this;
        //Object.freeze(this._links);
        //Object.freeze(this);
    }
    SvgDocument.prototype.render = function () {
        return this.definition + this.svg.render();
    };
    SvgDocument.prototype.clone = function () {
        return new SvgDocument(this.definition, this.svg.clone());
    };
    SvgDocument.prototype.getElementById = function (id) {
        var el = this._links[id];
        if (el) {
            return el[0];
        }
        return null;
    };
    return SvgDocument;
}());
exports.SvgDocument = SvgDocument;
function parse(text) {
    var stack = [{ content: "", children: [] }];
    function replacer(all, both, contents, data) {
        var match = null;
        if (data != null) {
            // Data
            if ((data || "").trim() === "") {
                return "";
            }
            stack[stack.length - 1].children.push(new Data(data));
        }
        else if (match = contents.match(/^<\s*([a-z0-9]+)(\s+((.|\n)*)\/\s*)>$/i)) {
            // Self-closing tag
            stack[stack.length - 1].children.push(new SvgNode(match[1], match[3], true));
        }
        else if (match = contents.match(/^<\s*\/\s*((.|\n)*)\s*>$/i)) {
            // Closing tag
            var node = stack.pop();
            if (node.name !== match[1]) {
                throw new Error("closing tag mismatch; " + match[1] + " != " + node.name);
            }
        }
        else if (match = contents.match(/^<\s*([a-z0-9]+)(\s+((.|\n)*))?>$/i)) {
            // Opening tag
            var node = new SvgNode(match[1], match[3], false);
            stack[stack.length - 1].children.push(node);
            stack.push(node);
        }
        else if (match = contents.match(/^<\?/im)) {
            // XML Definition
            if (stack[0].content) {
                throw new Error("duplicate xml definition");
            }
            stack[0].content = contents;
        }
        else if (match = contents.match(/^<!--(.*)-->/im)) {
            // Comment
        }
        else {
            throw new Error(JSON.stringify(contents));
        }
        return "";
    }
    text = text.replace(/((<[^>]*>)|(([^<>]|\n)*))/mg, replacer);
    // Check for unprocessed XML
    if (text.trim() !== "") {
        throw new Error("Junk XML leftover: " + JSON.stringify(text));
    }
    // Some basic sanity checks
    if (stack.length !== 1) {
        throw new Error("missing close tags");
    }
    if (stack[0].children.length !== 1) {
        throw new Error("too many svg tags");
    }
    return new SvgDocument(stack[0].content, stack[0].children[0]);
}
exports.parse = parse;
