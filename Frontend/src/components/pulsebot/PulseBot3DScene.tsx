import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import type { Mesh } from 'three'

function RobotCore() {
  const meshRef = useRef<Mesh>(null)
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.25
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15) * 0.2
    }
  })

  return (
    <Float speed={1.2} floatIntensity={0.3} rotationIntensity={0.1}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.9, 1]} />
        <meshStandardMaterial
          color="#0e7490"
          wireframe
          emissive="#06b6d4"
          emissiveIntensity={0.4}
          transparent
          opacity={0.95}
        />
      </mesh>
    </Float>
  )
}

function InnerGlow() {
  const meshRef = useRef<Mesh>(null)
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * -0.2
    }
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.35, 24, 24]} />
      <meshBasicMaterial
        color="#22d3ee"
        transparent
        opacity={0.5}
      />
    </mesh>
  )
}

function Ring() {
  const ringRef = useRef<Mesh>(null)
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.PI / 2
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.3
    }
  })

  return (
    <mesh ref={ringRef} position={[0, 0, 0]}>
      <torusGeometry args={[1.25, 0.02, 8, 64]} />
      <meshBasicMaterial color="#06b6d4" transparent opacity={0.7} />
    </mesh>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[4, 4, 4]} intensity={1} color="#22d3ee" />
      <pointLight position={[-3, -3, 2]} intensity={0.5} color="#34d399" />
      <RobotCore />
      <InnerGlow />
      <Ring />
    </>
  )
}

interface PulseBot3DSceneProps {
  /** When true, scene is used as full-page background (larger FOV, no rounded corners). */
  background?: boolean
}

export default function PulseBot3DScene({ background = false }: PulseBot3DSceneProps) {
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
          position: [0, 0, background ? 4.5 : 3.5],
          fov: background ? 55 : 45,
        }}
        dpr={[1, background ? 1 : 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
