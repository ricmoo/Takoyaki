"use strict";

// This is meant to be a very quick and dirty SVG parser. The SVG produced by
// Adobe Illustrator is well-formed, so for the most part. There has been very
// little work into sanitizing the input and providing useful error messages.

export interface NodeLike {
    _parentNode: NodeLike; // @TODO: rename to parentNode?
    render(): string;
    clone(): NodeLike;
}

export type Attributes = { [ attribute: string ]: string };

export class SvgNode implements NodeLike {
    readonly name: string;
    readonly attributes: Attributes;
    readonly selfClose: boolean;
    children: Array<NodeLike> // @TODO: would be nice if this was redonly...
    _parentNode: NodeLike;

    constructor(name: string, attributes: string | Attributes, selfClose: boolean) {
        this.name = name;
        this.attributes = { };
        this.selfClose = selfClose;
        this.children = [ ];

        this._parentNode = null;

        // Populate the attributes
        if (typeof(attributes) === "string") {
            let replacer = (all: string, key: string, value: string): string => {
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
                this.attributes[key] = (<any>attributes)[key];
            });
        }

        ///Object.freeze(this.attributes);
        ///Object.freeze(this.children);
        //Object.freeze(this);
    }

    render(): string {
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

    clone(): SvgNode {
        let node = new SvgNode(this.name, this.attributes, this.selfClose);
        this.children.forEach((child) => {
            node.children.push(child.clone());
        });
        return node;
    }

    remove(): void {
        const node: SvgNode = (<SvgNode>(this._parentNode));
        node.children = node.children.filter((child) => (child !== this));
    }

    static isNode(value: any): value is SvgNode {
        return (value instanceof SvgNode);
    }
}


export class Data implements NodeLike {
    readonly content: string;
    _parentNode: NodeLike;

    constructor(content: string) {
        this.content = content
        this._parentNode = null;
    }

    render(): string {
        return this.content;
    }

    clone(): Data {
        return new Data(this.content);
    }
}

export class SvgDocument implements NodeLike {
    readonly definition: string;
    readonly svg: SvgNode;
    readonly _links: { [ id: string ]: Array<SvgNode> };
    _parentNode: NodeLike;

    constructor(definition: string, svg: SvgNode) {
        this.definition = definition;
        this.svg = svg;

        this._links = { };

        let visit = (node: any) => {
            (node.children || []).forEach((child: any) => {
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

    render(): string {
        return this.definition + this.svg.render();
    }

    clone(): SvgDocument {
        return new SvgDocument(this.definition, this.svg.clone())
    }

    getElementById(id: string): SvgNode {
        let el = this._links[id];
        if (el) { return el[0]; }
        return null;
    }
}

export function parse(text: string): SvgDocument {
    let stack: Array<any> = [ { content: "", children: [ ] } ];

    function replacer(all: string, both: string, contents: string, data: string): string {
        let match = null;

        if (data != null) {
            // Data
            if ((data || "").trim() === "") { return ""; }
            stack[stack.length - 1].children.push(new Data(data));

        } else if (match = contents.match(/^<\s*([a-z0-9]+)(\s+((.|\n)*)\/\s*)>$/i)) {
            // Self-closing tag
            stack[stack.length - 1].children.push(new SvgNode(match[1], match[3], true));

        } else if (match = contents.match(/^<\s*\/\s*((.|\n)*)\s*>$/i)) {
            // Closing tag
            let node = stack.pop();
            if (node.name !== match[1]) { throw new Error(`closing tag mismatch; ${ match[1] } != ${ node.name }`); }

        } else if (match = contents.match(/^<\s*([a-z0-9]+)(\s+((.|\n)*))?>$/i)) {
            // Opening tag
            let node = new SvgNode(match[1], match[3], false);
            stack[stack.length - 1].children.push(node);
            stack.push(node)

        } else if (match = contents.match(/^<\?/im)) {
            // XML Definition
            if (stack[0].content) { throw new Error("duplicate xml definition"); }
            stack[0].content = contents;

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

    return new SvgDocument(stack[0].content, stack[0].children[0]);
}

