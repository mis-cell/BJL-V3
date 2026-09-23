import React from 'react';
import StockSummary from './StockSummary';

interface ClosingStockEntryProps {
  onClose?: () => void;
}

export default function ClosingStockEntry({ onClose }: ClosingStockEntryProps) {
  return (
    <StockSummary
      initialSubTab="opening"
      onClose={onClose}
    />
  );
}
