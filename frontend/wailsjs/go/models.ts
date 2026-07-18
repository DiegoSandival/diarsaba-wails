export namespace main {
	
	export class P2PChunk {
	    data: string;
	    eof: boolean;
	
	    static createFrom(source: any = {}) {
	        return new P2PChunk(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.data = source["data"];
	        this.eof = source["eof"];
	    }
	}
	export class P2PProvider {
	    id: string;
	    addrs: string[];
	
	    static createFrom(source: any = {}) {
	        return new P2PProvider(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.addrs = source["addrs"];
	    }
	}

}

