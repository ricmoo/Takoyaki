"use strict";

// This is meant to be a very quick and dirty SVG parser. The SVG produced by
// Adobe Illustrator i well-formed, so for themost part there has been very
// little work into sanitizing the input and providing useful error messages.


function Node(name, attributes, selfClose) {
    this.name = name;
    this.attributes = { };
    this.selfClose = selfClose;
    this.children = [ ];

    this._parentNode = null;

    // Populate the attributes
    if (typeof(attributes) === "string") {
        let replacer = (all, key, value) => {
            this.attributes[key] = value.replace(/\s+/g, " ");
            return "";
        }

        attributes = (attributes || "").replace(/([a-z:]+)\s*=\s*"(([^"]|\\.)*)"/ig, replacer);

        // Check for unprocessed attributes
        if (attributes.trim().length) {
            throw new Error("Junk attributes leftover: " + JSON.stringify(attributes));
        }
    } else if (attributes) {
        Object.keys(attributes).forEach((key) => {
            this.attributes[key] = attributes[key];
        });
    }

    ///Object.freeze(this.attributes);
    ///Object.freeze(this.children);
    //Object.freeze(this);
}

Node.prototype.render = function() {
    let result = "<" + this.name;
    result += Object.keys(this.attributes).map((key) => ` ${ key }="${ this.attributes[key] }"`).join("");

    // Self-closing tag; just close it and we're done
    if (this.selfClose) { return result + " />"; }

    // Can have children; add them and include a closing tag
    result += ">";
    result += this.children.map((child) => child.render()).join("");
    result += "</" + this.name + ">";

    return result;
}

Node.prototype.clone = function() {
    let node = new Node(this.name, this.attributes, this.selfClose);
    this.children.forEach((child) => {
        node.children.push(child.clone());
    });
    return node;
}

Node.prototype.remove = function() {
    this._parentNode.children = this._parentNode.children.filter((child) => (child !== this));
}


function Data(content) {
    this.content = content
    this._parentNode = null;
}

Data.prototype.render = function() {
    return this.content;
}

Data.prototype.clone = function() {
    return new Data(this.content);
}


function Document(definition, svg) {
    this.definition = definition;
    this.svg = svg;

    this._links = { };

    let visit = (node) => {
        (node.children || []).forEach((child) => {
            child._parentNode = node;
            visit(child);
        });

        if (node.attributes == null) { return; }
        let id = node.attributes["id"];
        if (id == null) { return; }

        if (this._links[id] == null) {
            this._links[id] = [ node ];
        } else {
            this._links[id].push(node);
        }
    }
    visit(this.svg);

    this.svg._parentNode = this;

    //Object.freeze(this._links);
    //Object.freeze(this);
}

Document.prototype.render = function() {
    return this.definition + this.svg.render();
}

Document.prototype.clone = function() {
    return new Document(this.definition, this.svg.clone())
}

Document.prototype.getElementById = function(id) {
    let el = this._links[id];
    if (el) { return el[0]; }
    return null;
}


function parse(text) {
    let stack = [ { content: "", children: [ ] } ];

    function replacer(all, both, contents, data) {
        let match = null;

        if (data != null) {
            // Data
            if ((data || "").trim() === "") { return ""; }
            stack[stack.length - 1].children.push(new Data(data));

        } else if (match = contents.match(/^<\s*([a-z0-9]+)(\s+((.|\n)*)\/\s*)>$/i)) {
            // Self-closing tag
            stack[stack.length - 1].children.push(new Node(match[1], match[3], true));

        } else if (match = contents.match(/^<\s*\/\s*((.|\n)*)\s*>$/i)) {
            // Closing tag
            let node = stack.pop();
            if (node.name !== match[1]) { throw new Error("closing tag mismatch; " + i); }

        } else if (match = contents.match(/^<\s*([a-z0-9]+)(\s+((.|\n)*))?>$/i)) {
            // Opening tag
            let node = new Node(match[1], match[3], false);
            stack[stack.length - 1].children.push(node);
            stack.push(node)

        } else if (match = contents.match(/^<\?/im)) {
            // XML Definition
            if (stack[0].contents) { throw new Error("duplicate xml definition"); }
            stack[0].contents = contents;

        } else if (match = contents.match(/^<!--(.*)-->/im)) {
            // Comment

        } else {
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
    if (stack.length !== 1) { throw new Error("missing close tags"); }
    if (stack[0].children.length !== 1) { throw new Error("too many svg tags"); }

    return new Document(stack[0].contents, stack[0].children[0]);
}

module.exports = {
    Data,
    Document,
    Node,

    parse
};
