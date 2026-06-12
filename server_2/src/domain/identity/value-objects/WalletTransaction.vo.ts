export interface WalletTransaction {
    txId: String;
    type:String;
    amount: number;
    currency: string;
    source:string,
    referenceId:string;
    createdAt: Date;
}
