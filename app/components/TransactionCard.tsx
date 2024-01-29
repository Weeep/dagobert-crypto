import React from 'react';
import TransactionIf from '../components/TransactionIf';

interface Props {
  transaction: TransactionIf;
}

const TransactionCard: React.FC<Props> = ({ transaction }) => {
    return (
        <div draggable className={`${transaction.side === 'BUY' ? 'bg-green-100' : 'bg-red-100'} p-4 rounded-md shadow-md`}>
            <h2 className="text-xl font-semibold mb-2">{transaction.symbol} - ${parseFloat(transaction.cummulativeQuoteQty as unknown as string).toFixed(2)}</h2>
            <p className="text-sm text-gray-600 mb-2">{transaction.executedQty} ({getPrice(transaction.cummulativeQuoteQty, transaction.executedQty)})</p>
            <p className="text-xs text-gray-500 mb-2">{transaction.type.toLowerCase()} - {formatDate(transaction.updateTime)}</p>
            <p className={`text-xs text-${transaction.side === 'BUY' ? 'lime' : 'red'}-600`}>{transaction.side}</p>
        </div>
    );
};

function getPrice(cummulativeQuoteQty: number, executedQty: number) {
    return (executedQty != 0) ? cummulativeQuoteQty / executedQty : 0;
}

function formatDate(epoch: number) {
    const date = new Date(epoch);
    return new Intl.DateTimeFormat('hu-HU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // Use 24-hour format
    }).format(date);
}

export default TransactionCard;
