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
	_create_desert_details()
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
	body.mesh = _paper_plane_mesh()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color("#f7f3e8")
	mat.roughness = 0.7
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	body.material_override = mat
	plane.add_child(body)

func _paper_plane_mesh() -> ArrayMesh:
	# Folded paper silhouette, nose points toward negative Z.
	var mesh := ArrayMesh.new()
	var vertices := PackedVector3Array([
		Vector3(0, 0.10, -1.25), Vector3(-1.05, 0.0, 0.72), Vector3(0, 0.16, 0.56), Vector3(1.05, 0.0, 0.72),
		Vector3(0, -0.02, -1.25), Vector3(-0.72, -0.03, 0.62), Vector3(0, 0.02, 0.56), Vector3(0.72, -0.03, 0.62)
	])
	var indices := PackedInt32Array([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6])
	var colors := PackedColorArray([
		Color("#fffdf4"), Color("#e7e1d2"), Color("#fffaf0"), Color("#d8d0bf"),
		Color("#c7bfaf"), Color("#eee9dc"), Color("#b6ad9e"), Color("#ddd5c6")
	])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_INDEX] = indices
	arrays[Mesh.ARRAY_COLOR] = colors
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh

func _create_desert_details() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 47291
	for i in range(85):
		var x := rng.randf_range(-145.0, 145.0)
		var z := rng.randf_range(-145.0, 145.0)
		if abs(x) < 8.0 and abs(z) < 20.0: continue
		var y := _height(x, z)
		if i % 5 == 0: _create_cactus(Vector3(x, y, z), rng.randf_range(.65, 1.35))
		elif i % 3 == 0: _create_rock(Vector3(x, y, z), rng.randf_range(.35, 1.15))
		else: _create_grass(Vector3(x, y, z), rng.randf_range(.7, 1.4))

func _material(color: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = .92
	return mat

func _create_cactus(pos: Vector3, scale: float) -> void:
	var root := Node3D.new()
	root.position = pos
	add_child(root)
	var trunk := MeshInstance3D.new()
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = .13 * scale; cylinder.bottom_radius = .18 * scale; cylinder.height = 1.9 * scale
	trunk.mesh = cylinder; trunk.material_override = _material(Color("#3f7046")); root.add_child(trunk)
	for side in [-1.0, 1.0]:
		var arm := MeshInstance3D.new(); var arm_mesh := CylinderMesh.new()
		arm_mesh.top_radius = .09 * scale; arm_mesh.bottom_radius = .11 * scale; arm_mesh.height = .62 * scale
		arm.mesh = arm_mesh; arm.material_override = _material(Color("#4d7e4c")); arm.position = Vector3(side * .24 * scale, .18 * scale, 0); arm.rotation.z = side * 1.1; root.add_child(arm)

func _create_rock(pos: Vector3, scale: float) -> void:
	var rock := MeshInstance3D.new(); var mesh := PrismMesh.new()
	mesh.size = Vector3(scale * 1.4, scale * .85, scale * 1.1); rock.mesh = mesh
	rock.position = pos + Vector3(0, scale * .35, 0); rock.rotation.y = pos.x * .13; rock.material_override = _material(Color("#75443a")); add_child(rock)

func _create_grass(pos: Vector3, scale: float) -> void:
	for side in [-1.0, 1.0]:
		var blade := MeshInstance3D.new(); var mesh := PrismMesh.new()
		mesh.size = Vector3(.06 * scale, .5 * scale, .06 * scale); blade.mesh = mesh
		blade.position = pos + Vector3(side * .12 * scale, .25 * scale, 0); blade.rotation.z = side * .34; blade.material_override = _material(Color("#8b804c")); add_child(blade)

func _create_camera() -> void:
	camera = Camera3D.new()
	# Close version-1 chase view: the paper plane stays large and readable.
	camera.position = Vector3(0, 1.15, 2.25)
	camera.look_at_from_position(camera.position, plane.position)
	add_child(camera)
	camera.current = true

func _process(delta: float) -> void:
	if plane == null or camera == null: return
	var input := Vector2(Input.get_axis("roll_left", "roll_right"), Input.get_axis("pitch_down", "pitch_up"))
	plane.rotation.z = lerp(plane.rotation.z, -input.x * 0.32, delta * 5.0)
	plane.rotation.x = lerp(plane.rotation.x, input.y * 0.18, delta * 5.0)
	plane.position.x += input.x * delta * 4.2
	plane.position.y += input.y * delta * 1.8
	plane.position.z -= delta * 8.0
	var target := plane.position + Vector3(0, 1.15, 2.25)
	camera.position = camera.position.lerp(target, 1.0 - exp(-delta * 8.0))
	camera.look_at(plane.position + Vector3(0, 0, -5), Vector3.UP)
