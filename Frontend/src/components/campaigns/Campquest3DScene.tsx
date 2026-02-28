import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Stars } from '@react-three/drei'
import type { Mesh } from 'three'
import * as THREE from 'three'

function DiceCube() {
  const meshRef = useRef<Mesh>(null)
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.35
    }
  })

  return (
    <Float speed={1.8} floatIntensity={0.4} rotationIntensity={0.15}>
      <mesh ref={meshRef}>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#b45309"
          emissiveIntensity={0.2}
          roughness={0.6}
          metalness={0.2}
          wireframe={false}
        />
      </mesh>
    </Float>
  )
}

function TrophyShape() {
  const meshRef = useRef<Mesh>(null)
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.25
    }
  })

  return (
    <Float speed={1.2} floatIntensity={0.35} rotationIntensity={0.1}>
      <mesh ref={meshRef} position={[1.2, 0.5, -1.5]}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#0891b2"
          emissiveIntensity={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>
    </Float>
  )
}

function QuestStar() {
  const meshRef = useRef<Mesh>(null)
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = state.clock.elapsedTime * 0.2
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15
    }
  })

  return (
    <Float speed={2} floatIntensity={0.5} rotationIntensity={0.2}>
      <mesh ref={meshRef} position={[-1.5, -0.8, -1.2]}>
        <dodecahedronGeometry args={[0.4, 0]} />
        <meshStandardMaterial
          color="#8b5cf6"
          emissive="#7c3aed"
          emissiveIntensity={0.35}
          transparent
          opacity={0.9}
        />
      </mesh>
    </Float>
  )
}

function FloatingOrbs() {
  const orbs = useMemo(
    () =>
      [
        { pos: [2.2, 1.2, -2] as [number, number, number], color: '#f59e0b', scale: 0.25 },
        { pos: [-2.2, -1, -1.8] as [number, number, number], color: '#06b6d4', scale: 0.2 },
        { pos: [1.8, -1.8, -2.2] as [number, number, number], color: '#ec4899', scale: 0.18 },
        { pos: [-2, 1, -1.5] as [number, number, number], color: '#8b5cf6', scale: 0.22 },
        { pos: [0, 2, -2.5] as [number, number, number], color: '#22c55e', scale: 0.15 },
      ],
    []
  )

  return (
    <>
      {orbs.map(({ pos, color, scale }, i) => (
        <FloatingOrb key={i} position={pos} color={color} scale={scale} speed={1 + i * 0.2} />
      ))}
    </>
  )
}

function FloatingOrb({
  position,
  color,
  scale,
  speed,
}: {
  position: [number, number, number]
  color: string
  scale: number
  speed: number
}) {
  const meshRef = useRef<Mesh>(null)
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.15
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[scale, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </mesh>
  )
}

function ParticleField() {
  const count = 600
  const points = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const palette = [
      [0.96, 0.62, 0.04], // amber
      [0.98, 0.45, 0.09], // orange
      [0.02, 0.71, 0.83], // cyan
      [0.55, 0.36, 0.96], // violet
    ]
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 35
      pos[i * 3 + 1] = (Math.random() - 0.5) * 35
      pos[i * 3 + 2] = (Math.random() - 0.5) * 35
      const [r, g, b] = palette[i % palette.length]
      colors[i * 3] = r
      colors[i * 3 + 1] = g
      colors[i * 3 + 2] = b
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    })
    return new THREE.Points(geo, mat)
  }, [])

  const ref = useRef<THREE.Points>(null)
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02
    }
  })

  return <primitive ref={ref} object={points} />
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[4, 4, 4]} intensity={1.2} color="#fbbf24" />
      <pointLight position={[-3, -2, 3]} intensity={0.6} color="#06b6d4" />
      <pointLight position={[0, 3, -2]} intensity={0.5} color="#8b5cf6" />
      <DiceCube />
      <TrophyShape />
      <QuestStar />
      <FloatingOrbs />
      <Stars radius={25} depth={40} count={800} factor={3} saturation={0.6} fade speed={0.8} />
      <ParticleField />
    </>
  )
}

export interface Campquest3DSceneProps {
  /** When true, scene is used as full-page background. */
  background?: boolean
}

export default function Campquest3DScene({ background = false }: Campquest3DSceneProps) {
  return (
    <div
      className={
        background
          ? 'absolute inset-0 w-full h-full overflow-hidden'
          : 'absolute inset-0 w-full h-full min-h-[200px] overflow-hidden rounded-2xl'
      }
    >
      <Canvas
        camera={{
          position: [0, 0, background ? 5 : 4],
          fov: background ? 55 : 45,
        }}
        dpr={[1, background ? 1.25 : 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
