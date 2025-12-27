'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import { Trade3D } from '@/lib/types';

interface Bubble {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  originalPosition: THREE.Vector3;
}

function BubbleScene({ trades }: { trades: Trade3D[] }) {
  const bubblesRef = useRef<Bubble[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  const { camera, scene } = useThree();

  useEffect(() => {
    // Clear previous bubbles
    bubblesRef.current.forEach(b => {
      scene.remove(b.mesh);
    });
    bubblesRef.current = [];

    // Create bubbles for each trade
    trades.slice(-50).forEach((trade, idx) => {
      const size = Math.max(0.2, Math.min(2, trade.value / 1_000_000));
      const color = trade.isBuy ? 0x10b981 : 0xef4444;

      const geometry = new THREE.IcosahedronGeometry(size, 4);
      const material = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.3,
        wireframe: false,
      });

      const mesh = new THREE.Mesh(geometry, material);

      // Position bubbles in a circular pattern
      const angle = (idx / Math.max(trades.length, 1)) * Math.PI * 2;
      const distance = 8 + Math.random() * 4;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = (Math.random() - 0.5) * 6;

      mesh.position.set(x, y, z);

      bubblesRef.current.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02
        ),
        originalPosition: mesh.position.clone(),
      });

      scene.add(mesh);
    });
  }, [trades, scene]);

  useFrame(() => {
    bubblesRef.current.forEach((bubble) => {
      // Gentle floating animation
      bubble.mesh.position.add(bubble.velocity);
      bubble.mesh.rotation.x += 0.01;
      bubble.mesh.rotation.y += 0.01;

      // Keep within bounds
      if (Math.abs(bubble.mesh.position.x) > 15) bubble.velocity.x *= -1;
      if (Math.abs(bubble.mesh.position.y) > 10) bubble.velocity.y *= -1;
      if (Math.abs(bubble.mesh.position.z) > 15) bubble.velocity.z *= -1;
    });
  });

  return (
    <group ref={groupRef}>
      {bubblesRef.current.map((bubble, idx) => (
        <primitive key={idx} object={bubble.mesh} />
      ))}
    </group>
  );
}

interface ThreeDVisualizerProps {
  trades: Trade3D[];
  loading?: boolean;
}

export function ThreeDVisualizer({ trades, loading = false }: ThreeDVisualizerProps) {
  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="animate-pulse text-gray-400">Loading 3D scene...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-4">
          <h2 className="text-lg font-semibold text-white mb-2">
            3D Whale Trade Visualization
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Green bubbles = Buys | Red bubbles = Sells | Bubble size = Trade value
          </p>
        </div>

        <div className="w-full h-96 bg-black">
          <Canvas
            camera={{
              position: [0, 5, 15],
              fov: 60,
            }}
            gl={{
              antialias: true,
              alpha: true,
              stencil: false,
            }}
          >
            <color attach="background" args={['#111827']} />

            {/* Lighting */}
            <ambientLight intensity={0.6} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color={0x3b82f6} />

            {/* Bubbles */}
            <BubbleScene trades={trades} />

            {/* Controls */}
            <OrbitControls
              autoRotate
              autoRotateSpeed={2}
              enableZoom
              enablePan
              enableRotate
            />

            {/* Grid */}
            <mesh position={[0, -8, 0]}>
              <planeGeometry args={[40, 40, 40, 40]} />
              <meshBasicMaterial
                color={0x1f2937}
                wireframe
                opacity={0.3}
                transparent
              />
            </mesh>
          </Canvas>
        </div>

        <div className="p-4 border-t border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Total Bubbles</p>
              <p className="text-xl font-bold text-white">{trades.length}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Buys vs Sells</p>
              <p className="text-sm">
                <span className="text-green-400 font-semibold">
                  {trades.filter(t => t.isBuy).length}
                </span>
                {' '}:{' '}
                <span className="text-red-400 font-semibold">
                  {trades.filter(t => !t.isBuy).length}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
