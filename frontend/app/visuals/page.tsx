'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const WhaleBubbleSpace = dynamic(
  () => import('@/components/WhaleBubbleSpace').then((mod) => mod.WhaleBubbleSpace),
  { ssr: false }
);

export default function VisualsPage() {
  return (
    <>
      <WhaleBubbleSpace />
    </>
  );
}
