'use client';

import { useState } from 'react';

export default function TestSuggestMenu() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // テスト用の食材データ: スーパーで売れ残りがちな食材10個
  const testIngredients = [
    {
      productName: 'キャベツ',
      discountedPrice: 120,
      unit: '1玉',
      quantity: 1,
      packCount: 2,
    },
    {
      productName: 'ナス',
      discountedPrice: 150,
      unit: '1本',
      quantity: 1,
      packCount: 3,
    },
    {
      productName: 'ブロッコリー',
      discountedPrice: 180,
      unit: '1房',
      quantity: 1,
      packCount: 2,
    },
    {
      productName: 'ジャガイモ',
      discountedPrice: 100,
      unit: '1kg',
      quantity: 1,
      packCount: 2,
    },
    {
      productName: 'トマト',
      discountedPrice: 140,
      unit: '1パック(3個)',
      quantity: 1,
      packCount: 2,
    },
    {
      productName: '豆もやし',
      discountedPrice: 80,
      unit: '200g',
      quantity: 1,
      packCount: 3,
    },
    {
      productName: '豚肉',
      discountedPrice: 380,
      unit: '300g',
      quantity: 1,
      packCount: 2,
    },
    {
      productName: '鶏肉',
      discountedPrice: 420,
      unit: '500g',
      quantity: 1,
      packCount: 1,
    },
    {
      productName: 'ニンジン',
      discountedPrice: 90,
      unit: '300g',
      quantity: 1,
      packCount: 2,
    },
    {
      productName: '玉ねぎ',
      discountedPrice: 70,
      unit: '400g',
      quantity: 1,
      packCount: 3,
    },
  ];

  const handleTest = async () => {
    setLoading(true);
    setResult('処理中...');

    try {
      const res = await fetch('/api/suggest-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: testIngredients }),
      });

      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult(`エラー: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">食材 → メニュー提案 テスト</h1>

      <div className="bg-gray-100 p-6 rounded mb-6">
        <h2 className="text-xl font-semibold mb-4">テスト食材 (10個):</h2>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>キャベツ: 120円 (2パック)</li>
          <li>ナス: 150円 (3個)</li>
          <li>ブロッコリー: 180円 (2房)</li>
          <li>ジャガイモ: 100円 (2パック)</li>
          <li>トマト: 140円 (2パック)</li>
          <li>豆もやし: 80円 (3パック)</li>
          <li>豚肉: 380円 (2パック)</li>
          <li>鶏肉: 420円 (1パック)</li>
          <li>ニンジン: 90円 (2パック)</li>
          <li>玉ねぎ: 70円 (3パック)</li>
        </ul>
      </div>

      <button
        onClick={handleTest}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-3 rounded font-semibold hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? '処理中...' : 'メニュー提案を実行'}
      </button>

      {result && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">結果:</h2>
          <pre className="bg-gray-200 p-6 rounded overflow-auto text-sm whitespace-pre-wrap break-words">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
}
