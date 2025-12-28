'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

type NewsItem = {
  title: string;
  link: string;
  pub_date: string;
  summary: string;
};

const formatDate = (value: string) => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
};

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        const res = await fetch('http://localhost:8000/api/news?limit=25');
        if (!res.ok) {
          return;
        }
        const payload = await res.json();
        if (payload.success && Array.isArray(payload.items)) {
          setItems(payload.items);
        }
      } catch (error) {
        console.error('News fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    const interval = setInterval(fetchNews, 120000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
        <h1 className="text-2xl font-semibold text-white">CoinDesk News Feed</h1>
        <p className="text-sm text-gray-400">Live headlines refreshed every 2 minutes</p>
      </div>

      {loading ? (
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 text-gray-400">
          Loading latest news...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((item) => (
            <article
              key={`${item.link}-${item.pub_date}`}
              className="bg-gray-900/50 border border-gray-700 rounded-lg p-5 hover:border-blue-500/60 transition-colors"
            >
              <h2 className="text-lg font-semibold text-white leading-snug">
                <a href={item.link} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              </h2>
              <p className="text-xs text-gray-500 mt-2">{formatDate(item.pub_date)}</p>
              {item.summary && (
                <p className="text-sm text-gray-300 mt-3 line-clamp-3">
                  {item.summary.replace(/<[^>]+>/g, '')}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </motion.div>
  );
}
