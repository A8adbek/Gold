extends Node3D

const MAP_RADIUS := 180.0
const GRID := 48
const CELL := 7.5
const SAND := Color("#c96b43")
const SAND_LIGHT := Color("#e19a61")

var plane: Node3D
var camera: Camera3D

func _ready() -> void:
	_render_environment()
	_create_terrain()
	_create_plane()
	_create_camera()

func _render_environment() -> void:
	var world := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#75b9d5")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#f5d6ad")
	env.ambient_light_energy = 0.72
	world.environment = env
	add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -28, 0)
	sun.light_color = Color("#ffe2b0")
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	add_child(sun)

func _height(x: float, z: float) -> float:
	return sin(x * 0.035) * 3.2 + sin(z * 0.027 + x * 0.012) * 4.5 + sin((x + z) * 0.085) * 0.8

func _create_terrain() -> void:
	var mesh := ArrayMesh.new()
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var indices := PackedInt32Array()
	for z in range(GRID + 1):
		for x in range(GRID + 1):
			var px := (x - GRID * 0.5) * CELL
			var pz := (z - GRID * 0.5) * CELL
			vertices.append(Vector3(px, _height(px, pz), pz))
			normals.append(Vector3.UP)
			colors.append(SAND_LIGHT if (x + z) % 7 == 0 else SAND)
	for z in range(GRID):
		for x in range(GRID):
			var i := z * (GRID + 1) + x
			indices.append_array([i, i + 1, i + GRID + 1, i + 1, i + GRID + 2, i + GRID + 1])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_INDEX] = indices
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var material := StandardMaterial3D.new()
	material.vertex_color_use_as_albedo = true
	material.roughness = 0.94
	var terrain := MeshInstance3D.new()
	terrain.mesh = mesh
	terrain.material_override = material
	add_child(terrain)

func _create_plane() -> void:
	plane = Node3D.new()
	plane.position = Vector3(0, 9, 0)
	add_child(plane)
	var body := MeshInstance3D.new()
	var mesh := PrismMesh.new()
	mesh.size = Vector3(1.4, 0.08, 2.4)
	body.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color("#f7f3e8")
	mat.roughness = 0.7
	body.material_override = mat
	plane.add_child(body)

func _create_camera() -> void:
	camera = Camera3D.new()
	camera.position = Vector3(0, 2.2, 5.5)
	camera.look_at_from_position(camera.position, plane.position)
	add_child(camera)
	camera.current = true

func _process(delta: float) -> void:
	if plane == null or camera == null: return
	var input := Vector2(Input.get_axis("roll_left", "roll_right"), Input.get_axis("pitch_down", "pitch_up"))
	plane.rotation.z = lerp(plane.rotation.z, -input.x * 0.32, delta * 5.0)
	plane.rotation.x = lerp(plane.rotation.x, input.y * 0.18, delta * 5.0)
	plane.position.z -= delta * 8.0
	var target := plane.position + Vector3(0, 1.6, 5.5)
	camera.position = camera.position.lerp(target, 1.0 - exp(-delta * 8.0))
	camera.look_at(plane.position + Vector3(0, 0, -6), Vector3.UP)
