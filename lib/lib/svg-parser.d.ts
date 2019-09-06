export interface NodeLike {
    _parentNode: NodeLike;
    render(): string;
    clone(): NodeLike;
}
export declare type Attributes = {
    [attribute: string]: string;
};
export declare class SvgNode implements NodeLike {
    readonly name: string;
    readonly attributes: Attributes;
    readonly selfClose: boolean;
    children: Array<NodeLike>;
    _parentNode: NodeLike;
    constructor(name: string, attributes: string | Attributes, selfClose: boolean);
    render(): string;
    clone(): SvgNode;
    remove(): void;
    static isNode(value: any): value is SvgNode;
}
export declare class Data implements NodeLike {
    readonly content: string;
    _parentNode: NodeLike;
    constructor(content: string);
    render(): string;
    clone(): Data;
}
export declare class SvgDocument implements NodeLike {
    readonly definition: string;
    readonly svg: SvgNode;
    readonly _links: {
        [id: string]: Array<SvgNode>;
    };
    _parentNode: NodeLike;
    constructor(definition: string, svg: SvgNode);
    render(): string;
    clone(): SvgDocument;
    getElementById(id: string): SvgNode;
}
export declare function parse(text: string): SvgDocument;
