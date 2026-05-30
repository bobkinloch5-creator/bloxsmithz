import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Kind = "classic_shirt" | "classic_pants" | "tshirt" | "layered_or_accessory";

/**
 * Client-only Roblox-style avatar preview of a generated clothing texture.
 * Renders an R6-style blocky humanoid with skin-toned head/arms (or legs for
 * pants) and the generated PNG mapped onto the clothed parts. The flat
 * downloadable PNG is unaffected — this is purely an in-browser preview.
 */
export function ClothingPreview3D({
  imageUrl,
  kind,
}: {
  imageUrl: string;
  kind: Kind;
}) {
  const [mod, setMod] = useState<null | {
    Canvas: any;
    OrbitControls: any;
    ContactShadows: any;
    Environment: any;
    THREE: any;
  }>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      import("@react-three/fiber"),
      import("@react-three/drei"),
      import("three"),
    ])
      .then(([fiber, drei, three]) => {
        if (alive)
          setMod({
            Canvas: fiber.Canvas,
            OrbitControls: drei.OrbitControls,
            ContactShadows: drei.ContactShadows,
            Environment: drei.Environment,
            THREE: three,
          });
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
        3D preview couldn't load here — the downloadable PNG is unaffected.
      </div>
    );
  }

  if (!mod) {
    return (
      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading 3D preview…
      </div>
    );
  }

  const { Canvas, OrbitControls, ContactShadows, THREE } = mod;

  return (
    <Canvas
      camera={{ position: [0, 1.2, 6.2], fov: 32 }}
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true }}
    >
      {/* Soft gradient backdrop */}
      <color attach="background" args={["#0b0d14"]} />
      <fog attach="fog" args={["#0b0d14", 8, 18]} />

      {/* Key / fill / rim lighting for a clean studio look */}
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 3, -2]} intensity={0.35} color="#7aa2ff" />
      <pointLight position={[0, 2, 5]} intensity={0.4} color="#a0e9ff" />

      <Avatar imageUrl={imageUrl} kind={kind} THREE={THREE} />

      <ContactShadows
        position={[0, -1.55, 0]}
        opacity={0.55}
        scale={6}
        blur={2.4}
        far={3}
        color="#000000"
      />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={1.2}
        minPolarAngle={Math.PI / 2.8}
        maxPolarAngle={Math.PI / 1.9}
        target={[0, 0.4, 0]}
      />
    </Canvas>
  );
}

function useTexture(imageUrl: string, THREE: any) {
  const [tex, setTex] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      imageUrl,
      (t: any) => {
        if (!alive) return;
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        setTex(t);
      },
      undefined,
      () => {
        /* leave tex null → falls back to solid material */
      },
    );
    return () => {
      alive = false;
    };
  }, [imageUrl, THREE]);
  return tex;
}

const SKIN = "#f0c89a";
const HAIR = "#1f1410";
const DEFAULT_PANTS = "#2b313d";
const DEFAULT_SHIRT = "#3a4150";

function Avatar({
  imageUrl,
  kind,
  THREE: _THREE,
}: {
  imageUrl: string;
  kind: Kind;
  THREE: any;
}) {
  const tex = useTexture(imageUrl, _THREE);

  const isPants = kind === "classic_pants";
  const isShirtLike = !isPants; // classic_shirt | tshirt | layered

  const clothedMat = tex ? { map: tex } : { color: isPants ? DEFAULT_PANTS : DEFAULT_SHIRT };
  const fallbackShirt = { color: DEFAULT_SHIRT };
  const fallbackPants = { color: DEFAULT_PANTS };

  // R6-ish proportions with small gaps between parts so they read as separate limbs.
  return (
    <group position={[0, -0.25, 0]}>
      {/* Hair cap */}
      <mesh position={[0, 2.18, 0]} castShadow>
        <boxGeometry args={[0.7, 0.18, 0.7]} />
        <meshStandardMaterial color={HAIR} roughness={0.7} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.78, 0]} castShadow>
        <boxGeometry args={[0.66, 0.66, 0.66]} />
        <meshStandardMaterial color={SKIN} roughness={0.85} />
      </mesh>

      {/* Eyes */}
      <mesh position={[-0.14, 1.82, 0.331]}>
        <boxGeometry args={[0.08, 0.08, 0.01]} />
        <meshStandardMaterial color="#0d0d0d" />
      </mesh>
      <mesh position={[0.14, 1.82, 0.331]}>
        <boxGeometry args={[0.08, 0.08, 0.01]} />
        <meshStandardMaterial color="#0d0d0d" />
      </mesh>

      {/* Neck gap is implicit via spacing */}

      {/* Torso (shirt) */}
      <mesh position={[0, 0.92, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 1.1, 0.55]} />
        <meshStandardMaterial
          {...(isShirtLike ? clothedMat : fallbackShirt)}
          roughness={0.75}
          metalness={0.02}
        />
      </mesh>

      {/* Arms — separated from torso by a clear gap */}
      {[-0.72, 0.72].map((x) => (
        <mesh key={x} position={[x, 0.92, 0]} castShadow>
          <boxGeometry args={[0.36, 1.1, 0.4]} />
          <meshStandardMaterial
            {...(isShirtLike ? clothedMat : { color: SKIN })}
            roughness={isShirtLike ? 0.75 : 0.85}
          />
        </mesh>
      ))}

      {/* Hands (always skin) */}
      {[-0.72, 0.72].map((x) => (
        <mesh key={`h${x}`} position={[x, 0.27, 0]} castShadow>
          <boxGeometry args={[0.36, 0.18, 0.4]} />
          <meshStandardMaterial color={SKIN} roughness={0.85} />
        </mesh>
      ))}

      {/* Legs */}
      {[-0.26, 0.26].map((x) => (
        <mesh key={`l${x}`} position={[x, -0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.46, 1.3, 0.5]} />
          <meshStandardMaterial
            {...(isPants ? clothedMat : fallbackPants)}
            roughness={0.8}
          />
        </mesh>
      ))}

      {/* Shoes */}
      {[-0.26, 0.26].map((x) => (
        <mesh key={`s${x}`} position={[x, -1.05, 0.03]} castShadow>
          <boxGeometry args={[0.5, 0.22, 0.58]} />
          <meshStandardMaterial color="#15171c" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}
