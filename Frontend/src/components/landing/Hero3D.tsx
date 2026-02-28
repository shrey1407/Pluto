import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Stars, Sphere } from '@react-three/drei'
import type { Mesh } from 'three'
import * as THREE from 'three'

function PlutoSphere() {
  const meshRef = useRef<Mesh>(null)
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15
    }
  })

  return (
    <Float speed={1.5} floatIntensity={0.4} rotationIntensity={0.2}>
      <Sphere ref={meshRef} args={[1.2, 64, 64]} scale={1}>
        <meshStandardMaterial
          color="#8B6914"
          roughness={0.85}
          metalness={0.1}
          emissive="#5c3d0e"
          emissiveIntensity={0.15}
        />
      </Sphere>
    </Float>
  )
}

function OrbitingRings() {
  const ringRef = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.PI / 2.2
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.08
    }
  })

  return (
    <mesh ref={ringRef} position={[0, 0, 0]}>
      <torusGeometry args={[1.8, 0.03, 16, 100]} />
      <meshBasicMaterial color="#f59e0b" transparent opacity={0.5} />
    </mesh>
  )
}

function ParticleField() {
  const count = 800
  const points = useMemo(() => {
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.06,
      color: '#fbbf24',
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    })
    return new THREE.Points(geo, mat)
  }, [])

  return <primitive object={points} />
}

function FloatingOrbs() {
  const orbs = useMemo(
    () =>
      [
        { pos: [2.5, 1, -2] as [number, number, number], color: '#f59e0b', scale: 0.2 },
        { pos: [-2, -1.2, -1.5] as [number, number, number], color: '#d97706', scale: 0.15 },
        { pos: [1.5, -2, -2.5] as [number, number, number], color: '#b45309', scale: 0.18 },
        { pos: [-2.5, 0.8, -1] as [number, number, number], color: '#fbbf24', scale: 0.12 },
      ],
    []
  )

  return (
    <>
      {orbs.map(({ pos, color, scale }, i) => (
        <Float key={i} speed={2 + i * 0.5} floatIntensity={0.5}>
          <Sphere args={[1, 32, 32]} position={pos} scale={scale}>
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </Sphere>
        </Float>
      ))}
    </>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#fef3c7" />
      <pointLight position={[-8, -8, 5]} intensity={0.8} color="#fcd34d" />
      <Stars radius={50} depth={50} count={2000} factor={2} saturation={0.4} fade speed={1} />
      <ParticleField />
      <PlutoSphere />
      <OrbitingRings />
      <FloatingOrbs />
    </>
  )
}

export default function Hero3D() {
  return (
    <section className="relative w-full h-screen min-h-[600px] overflow-hidden bg-[#0a0a0f]">
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 6], fov: 55 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene />
        </Canvas>
      </div>
      {/* Gradient overlay so text is readable */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 30%, rgba(10,10,15,0.6) 70%, rgba(10,10,15,0.95) 100%)',
        }}
      />
    </section>
  )
}
