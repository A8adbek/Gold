extends Node3D

const MAP_RADIUS := 360.0
const GRID := 96
const CELL := 7.5
const SAND := Color("#d18f6d")
const SAND_LIGHT := Color("#e3b08a")
# The source SRTM tile is 3601x3601 samples.  The game terrain is only
# 97x97 vertices, so loading every source sample on the Android main thread
# needlessly blocks the first frame.  Keep a 257x257 working grid instead.
const DEM_SIZE := 257
const DEM_SOURCE_SIZE := 3601

var plane: Node3D
var camera: Camera3D
var velocity := Vector3(0, 0, -8.0)
var airspeed := 8.0
var elapsed := 0.0
var touch_origin := Vector2.ZERO
var touch_axis := Vector2.ZERO
var touch_active := false
var speed_label: Label
var altitude_label: Label
var distance_label: Label
var hud_layer: CanvasLayer
var menu_layer: CanvasLayer
var pause_overlay: Control
var pause_button: Button
var pause_title: Label
var overlay_primary: Button
var settings_panel: Control
var left_wing: Node3D
var right_wing: Node3D
var game_started := false
var paused := false
var flight_state := "menu"
var wind_playback: AudioStreamGeneratorPlayback
var turn_playback: AudioStreamGeneratorPlayback
var audio_phase := 0.0
var audio_mix_rate := 22050.0
var dem_data := PackedInt32Array()
var dem_min := 0
var dem_max := 1

func _ready() -> void:
	_render_environment()
	_create_audio()
	_load_elevation_tile()
	_create_terrain()
	_create_desert_details()
	_create_canyon_details()
	_create_dune_ridges()
	_create_stratified_cliffs()
	_create_landmark_details()
	_create_plane()
	_create_camera()
	_create_hud()
	_create_menu()
	hud_layer.visible = false
	set_process_unhandled_input(true)

func _create_audio() -> void:
	var music := AudioStreamPlayer.new()
	music.name = "DesertMusic"
	music.stream = load("res://assets/cinematic-desert-1.mp3")
	music.volume_db = -8.0
	music.autoplay = true
	add_child(music)
	music.finished.connect(func(): music.play())
	# Lightweight procedural audio keeps the APK small while adding flight feedback.
	var wind_stream := AudioStreamGenerator.new()
	wind_stream.mix_rate = audio_mix_rate
	wind_stream.buffer_length = 0.18
	var wind := AudioStreamPlayer.new()
	wind.name = "WindAudio"
	wind.stream = wind_stream
	wind.volume_db = -12.0
	add_child(wind)
	wind.play()
	wind_playback = wind.get_stream_playback()
	var turn_stream := AudioStreamGenerator.new()
	turn_stream.mix_rate = audio_mix_rate
	turn_stream.buffer_length = 0.12
	var turn := AudioStreamPlayer.new()
	turn.name = "TurnAudio"
	turn.stream = turn_stream
	turn.volume_db = -17.0
	add_child(turn)
	turn.play()
	turn_playback = turn.get_stream_playback()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			touch_origin = event.position
			touch_axis = Vector2.ZERO
			touch_active = true
		else:
			touch_axis = Vector2.ZERO
			touch_active = false
	elif event is InputEventScreenDrag and touch_active:
		touch_axis = (event.position - touch_origin).limit_length(90.0) / 90.0

func _render_environment() -> void:
	var world := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#b9cbd1")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#f8d9bc")
	env.ambient_light_energy = 0.72
	env.fog_enabled = true
	env.fog_light_color = Color("#e6c4aa")
	env.fog_light_energy = 0.55
	env.fog_density = 0.004
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	world.environment = env
	add_child(world)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -28, 0)
	sun.light_color = Color("#ffe2b0")
	sun.light_energy = 1.15
	sun.shadow_enabled = true
	add_child(sun)

func _height(x: float, z: float) -> float:
	var detail := sin(x * 0.035) * 3.2 + sin(z * 0.027 + x * 0.012) * 4.5 + sin((x + z) * 0.085) * 0.8
	if dem_data.is_empty(): return detail
	var tx := clampi(int((x + 360.0) / 720.0 * float(DEM_SIZE - 1)), 0, DEM_SIZE - 1)
	var tz := clampi(int((z + 360.0) / 720.0 * float(DEM_SIZE - 1)), 0, DEM_SIZE - 1)
	var raw := float(dem_data[tz * DEM_SIZE + tx])
	var terrain_level: float = ((raw - float(dem_min)) / max(1.0, float(dem_max - dem_min))) * 34.0 - 10.0
	return terrain_level + detail * 0.18

func _load_elevation_tile() -> void:
	var path := "res://assets/maps/N40E069.hgt"
	if not FileAccess.file_exists(path): return
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null: return
	var sample_count := DEM_SIZE * DEM_SIZE
	dem_data.resize(sample_count)
	dem_min = 32767
	dem_max = -32768
	for z in range(DEM_SIZE):
		var source_z := int(round(float(z) / float(DEM_SIZE - 1) * float(DEM_SOURCE_SIZE - 1)))
		for x in range(DEM_SIZE):
			var source_x := int(round(float(x) / float(DEM_SIZE - 1) * float(DEM_SOURCE_SIZE - 1)))
			file.seek((source_z * DEM_SOURCE_SIZE + source_x) * 2)
			var i := z * DEM_SIZE + x
			var value := file.get_16()
			if value >= 32768: value -= 65536
			dem_data[i] = value
			dem_min = mini(dem_min, value)
			dem_max = maxi(dem_max, value)

func _create_terrain() -> void:
	var mesh := ArrayMesh.new()
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var colors := PackedColorArray()
	var uvs := PackedVector2Array()
	var indices := PackedInt32Array()
	for z in range(GRID + 1):
		for x in range(GRID + 1):
			var px := (x - GRID * 0.5) * CELL
			var pz := (z - GRID * 0.5) * CELL
			vertices.append(Vector3(px, _height(px, pz), pz))
			var dx := (_height(px + .2, pz) - _height(px - .2, pz)) / .4
			var dz := (_height(px, pz + .2) - _height(px, pz - .2)) / .4
			normals.append(Vector3(-dx, 1.0, -dz).normalized())
			colors.append(SAND_LIGHT if (x + z) % 7 == 0 else SAND)
			uvs.append(Vector2(float(x) / float(GRID) * 6.0, float(z) / float(GRID) * 6.0))
	for z in range(GRID):
		for x in range(GRID):
			var i := z * (GRID + 1) + x
			indices.append_array([i, i + 1, i + GRID + 1, i + 1, i + GRID + 2, i + GRID + 1])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_COLOR] = colors
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var material := StandardMaterial3D.new()
	material.albedo_texture = _texture("res://assets/hires/sand_01_diff.jpg", "res://assets/desert_sand.svg")
	material.albedo_color = Color.WHITE
	material.vertex_color_use_as_albedo = false
	material.roughness = 0.94
	var terrain := MeshInstance3D.new()
	terrain.mesh = mesh
	terrain.material_override = material
	add_child(terrain)

func _create_plane() -> void:
	plane = Node3D.new()
	plane.position = Vector3(0, 9, 0)
	plane.scale = Vector3(0.72, 0.72, 0.72)
	add_child(plane)
	var body := MeshInstance3D.new()
	body.mesh = _paper_plane_mesh()
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color("#f7f3e8")
	mat.roughness = 0.7
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	body.material_override = mat
	plane.add_child(body)

func _create_flex_wing(side: float, color: Color) -> Node3D:
	var hinge := Node3D.new()
	hinge.position = Vector3(0, 0.035, 0.56)
	var wing := MeshInstance3D.new()
	wing.mesh = _flex_wing_mesh(side)
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.72
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	wing.material_override = material
	hinge.add_child(wing)
	return hinge

func _flex_wing_mesh(side: float) -> ArrayMesh:
	var mesh := ArrayMesh.new()
	var vertices := PackedVector3Array([
		Vector3(0, 0, 0),
		Vector3(side * 1.05, -0.012, 0.18),
		Vector3(side * 0.05, 0.09, -1.30)
	])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_INDEX] = PackedInt32Array([0, 1, 2])
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh

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
		var x := rng.randf_range(-310.0, 310.0)
		var z := rng.randf_range(-310.0, 310.0)
		if abs(x) < 8.0 and abs(z) < 20.0: continue
		var y := _height(x, z)
		if i % 5 == 0: _create_cactus(Vector3(x, y, z), rng.randf_range(.65, 1.35))
		elif i % 3 == 0: _create_rock(Vector3(x, y, z), rng.randf_range(.35, 1.15))
		else: _create_grass(Vector3(x, y, z), rng.randf_range(.7, 1.4))

func _create_canyon_details() -> void:
	# Large layered mesas make the valley feel open and deep without a visible map edge.
	var rng := RandomNumberGenerator.new()
	rng.seed = 90817
	for i in range(18):
		var side := -1.0 if i % 2 == 0 else 1.0
		var x := side * rng.randf_range(90.0, 320.0)
		var z := rng.randf_range(-320.0, 320.0)
		var y := _height(x, z)
		_create_mesa(Vector3(x, y, z), rng.randf_range(3.0, 8.5), rng.randf_range(5.0, 13.0))

func _create_dune_ridges() -> void:
	# Low-poly dune shoulders create layered depth without a road or moving floor.
	var rng := RandomNumberGenerator.new()
	rng.seed = 119203
	for i in range(34):
		var side := -1.0 if i % 2 == 0 else 1.0
		var x := side * rng.randf_range(45.0, 300.0)
		var z := rng.randf_range(-320.0, 320.0)
		var y := _height(x, z) - 0.8
		var dune := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radial_segments = 12
		mesh.rings = 5
		mesh.height = rng.randf_range(8.0, 18.0)
		mesh.radius = rng.randf_range(10.0, 24.0)
		dune.mesh = mesh
		dune.scale = Vector3(1.8, 0.42, 2.8)
		dune.position = Vector3(x, y, z)
		dune.rotation.y = rng.randf_range(-0.8, 0.8)
		dune.material_override = _material(Color("#ffffff"), "res://assets/hires/sand_01_diff.jpg")
		add_child(dune)

func _create_stratified_cliffs() -> void:
	# Stacked strata give the distant canyon walls a more detailed silhouette.
	var rng := RandomNumberGenerator.new()
	rng.seed = 44127
	for i in range(16):
		var side := -1.0 if i % 2 == 0 else 1.0
		var x := side * rng.randf_range(110.0, 330.0)
		var z := rng.randf_range(-330.0, 330.0)
		var y := _height(x, z)
		var root := Node3D.new()
		root.position = Vector3(x, y, z)
		root.rotation.y = rng.randf_range(-0.5, 0.5)
		add_child(root)
		for layer in range(3):
			var slab := MeshInstance3D.new()
			var mesh := CylinderMesh.new()
			mesh.top_radius = rng.randf_range(5.0, 10.0) - layer * 0.35
			mesh.bottom_radius = mesh.top_radius * 1.12
			mesh.height = rng.randf_range(2.0, 4.0)
			mesh.radial_segments = 8
			slab.mesh = mesh
			slab.position.y = layer * 3.0 + mesh.height * 0.5
			slab.material_override = _material(Color("#ffffff"), "res://assets/hires/rock_08_diff.jpg")
			root.add_child(slab)

func _create_landmark_details() -> void:
	# Distinctive static rock landmarks break up the repeated procedural silhouettes.
	var rng := RandomNumberGenerator.new()
	rng.seed = 78104
	for i in range(14):
		var side := -1.0 if i % 2 == 0 else 1.0
		var x := side * rng.randf_range(70.0, 300.0)
		var z := rng.randf_range(-300.0, 300.0)
		var y := _height(x, z)
		var root := Node3D.new()
		root.position = Vector3(x, y, z)
		root.rotation.y = rng.randf_range(-0.7, 0.7)
		add_child(root)
		for tower in range(3):
			var spire := MeshInstance3D.new()
			var mesh := CylinderMesh.new()
			mesh.top_radius = rng.randf_range(0.2, 1.2)
			mesh.bottom_radius = rng.randf_range(2.0, 4.5)
			mesh.height = rng.randf_range(6.0, 15.0)
			mesh.radial_segments = 7
			spire.mesh = mesh
			spire.position = Vector3(rng.randf_range(-5.0, 5.0), mesh.height * 0.5, rng.randf_range(-4.0, 4.0))
			spire.rotation.z = rng.randf_range(-0.16, 0.16)
			spire.material_override = _material(Color("#ffffff"), "res://assets/canyon_rock.svg")
			root.add_child(spire)
	for i in range(28):
		var x := rng.randf_range(-300.0, 300.0)
		var z := rng.randf_range(-300.0, 300.0)
		if abs(x) < 14.0 and abs(z) < 26.0: continue
		var y := _height(x, z)
		_create_rock_cluster(Vector3(x, y, z), rng.randf_range(0.8, 1.8), rng)

func _create_rock_cluster(pos: Vector3, scale: float, rng: RandomNumberGenerator) -> void:
	var root := Node3D.new()
	root.position = pos
	root.rotation.y = rng.randf_range(-1.0, 1.0)
	add_child(root)
	for i in range(3):
		var stone := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radial_segments = 8
		mesh.rings = 4
		mesh.radius = rng.randf_range(0.35, 0.75) * scale
		mesh.height = rng.randf_range(0.65, 1.3) * scale
		stone.mesh = mesh
		stone.position = Vector3(rng.randf_range(-1.0, 1.0) * scale, mesh.height * 0.35, rng.randf_range(-0.8, 0.8) * scale)
		stone.rotation = Vector3(rng.randf_range(-0.3, 0.3), rng.randf_range(-1.0, 1.0), rng.randf_range(-0.2, 0.2))
		stone.material_override = _material(Color("#ffffff"), "res://assets/canyon_rock.svg")
		root.add_child(stone)

func _create_mesa(pos: Vector3, radius: float, height: float) -> void:
	var root := Node3D.new()
	root.position = pos + Vector3(0, height * .5, 0)
	root.rotation.y = pos.x * .021
	add_child(root)
	var base := MeshInstance3D.new()
	var base_mesh := CylinderMesh.new()
	base_mesh.top_radius = radius * .68
	base_mesh.bottom_radius = radius
	base_mesh.height = height
	base.mesh = base_mesh
	base.material_override = _material(Color("#ffffff"), "res://assets/canyon_rock.svg")
	root.add_child(base)
	var cap := MeshInstance3D.new()
	var cap_mesh := CylinderMesh.new()
	cap_mesh.top_radius = radius * .64
	cap_mesh.bottom_radius = radius * .70
	cap_mesh.height = .55
	cap.position.y = height * .51
	cap.mesh = cap_mesh
	cap.material_override = _material(Color("#e7b08a"), "res://assets/canyon_rock.svg")
	root.add_child(cap)

func _material(color: Color, texture_path: String = "") -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	if texture_path != "" and ResourceLoader.exists(texture_path): mat.albedo_texture = load(texture_path)
	mat.roughness = .92
	return mat

func _texture(preferred: String, fallback: String) -> Texture2D:
	if ResourceLoader.exists(preferred): return load(preferred)
	return load(fallback)

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
	camera.position = Vector3(0, 1.35, 3.15)
	camera.look_at_from_position(camera.position, plane.position)
	add_child(camera)
	camera.current = true

func _create_hud() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 20
	hud_layer = layer
	add_child(layer)
	speed_label = _hud_label(layer, Vector2(22, 28), "SPEED  0.0 m/s")
	pause_button = _ui_button("PAUSE", Vector2(555, 24), Vector2(140, 52))
	layer.add_child(pause_button)
	pause_button.pressed.connect(_toggle_pause)
	pause_overlay = Control.new()
	pause_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	pause_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	pause_overlay.visible = false
	layer.add_child(pause_overlay)
	var shade := ColorRect.new()
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.color = Color(0.02, 0.03, 0.04, 0.68)
	pause_overlay.add_child(shade)
	pause_title = Label.new()
	pause_title.text = "PAUSED"
	pause_title.position = Vector2(278, 390)
	pause_title.add_theme_font_size_override("font_size", 28)
	pause_title.add_theme_color_override("font_color", Color("#fff4df"))
	pause_overlay.add_child(pause_title)
	overlay_primary = _ui_button("RESUME", Vector2(250, 475), Vector2(220, 58))
	pause_overlay.add_child(overlay_primary)
	overlay_primary.pressed.connect(_overlay_primary_pressed)
	var menu := _ui_button("MAIN MENU", Vector2(250, 550), Vector2(220, 58))
	pause_overlay.add_child(menu)
	menu.pressed.connect(_return_to_menu)

func _create_menu() -> void:
	menu_layer = CanvasLayer.new()
	menu_layer.layer = 30
	add_child(menu_layer)
	var background := ColorRect.new()
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.color = Color("#c8754b")
	menu_layer.add_child(background)
	var title := Label.new()
	title.text = "RED DUNE VALLEY"
	title.position = Vector2(145, 250)
	title.add_theme_font_size_override("font_size", 30)
	title.add_theme_color_override("font_color", Color("#fff4df"))
	menu_layer.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "PAPER FLIGHT"
	subtitle.position = Vector2(275, 298)
	subtitle.add_theme_font_size_override("font_size", 14)
	subtitle.add_theme_color_override("font_color", Color("#f4d2ae"))
	menu_layer.add_child(subtitle)
	var play := _ui_button("PLAY", Vector2(220, 455), Vector2(280, 68))
	menu_layer.add_child(play)
	play.pressed.connect(_start_game)
	var settings := _ui_button("SETTINGS", Vector2(220, 540), Vector2(280, 68))
	menu_layer.add_child(settings)
	settings.pressed.connect(_show_settings)
	var panel := Panel.new()
	panel.position = Vector2(80, 350)
	panel.size = Vector2(560, 410)
	panel.visible = false
	menu_layer.add_child(panel)
	settings_panel = panel
	var settings_title := Label.new()
	settings_title.text = "SETTINGS"
	settings_title.position = Vector2(195, 42)
	settings_title.add_theme_font_size_override("font_size", 25)
	settings_title.add_theme_color_override("font_color", Color("#fff4df"))
	panel.add_child(settings_title)
	var info := Label.new()
	info.text = "SOUND   ON\nCONTROL  DRAG TO STEER\nCAMERA   CLOSE CHASE"
	info.position = Vector2(110, 125)
	info.add_theme_font_size_override("font_size", 15)
	info.add_theme_color_override("font_color", Color("#fff4df"))
	panel.add_child(info)
	var back := _ui_button("BACK", Vector2(170, 295), Vector2(220, 58))
	panel.add_child(back)
	back.pressed.connect(_hide_settings)

func _ui_button(text: String, pos: Vector2, size: Vector2) -> Button:
	var button := Button.new()
	button.text = text
	button.position = pos
	button.size = size
	button.add_theme_font_size_override("font_size", 16)
	button.add_theme_color_override("font_color", Color("#fff4df"))
	button.add_theme_color_override("font_hover_color", Color("#ffffff"))
	return button

func _start_game() -> void:
	game_started = true
	paused = false
	flight_state = "flying"
	menu_layer.visible = false
	hud_layer.visible = true
	pause_overlay.visible = false
	pause_button.text = "PAUSE"
	pause_title.text = "PAUSED"
	overlay_primary.text = "RESUME"
	plane.position = Vector3(0, 9, 0)
	velocity = Vector3(0, 0, -8.0)

func _toggle_pause() -> void:
	if not game_started or flight_state != "flying": return
	paused = not paused
	pause_overlay.visible = paused
	pause_button.text = "RESUME" if paused else "PAUSE"
	pause_title.text = "PAUSED"
	overlay_primary.text = "RESUME"

func _overlay_primary_pressed() -> void:
	if flight_state == "landed" or flight_state == "crashed":
		_start_game()
	else:
		_toggle_pause()

func _finish_flight(result: String) -> void:
	flight_state = result.to_lower()
	paused = true
	pause_overlay.visible = true
	pause_title.text = result
	overlay_primary.text = "RESTART"
	pause_button.text = "PAUSE"

func _return_to_menu() -> void:
	game_started = false
	paused = false
	flight_state = "menu"
	hud_layer.visible = false
	pause_overlay.visible = false
	menu_layer.visible = true
	pause_button.text = "PAUSE"

func _show_settings() -> void:
	for child in menu_layer.get_children():
		if child is Control: child.visible = false
	settings_panel.visible = true

func _hide_settings() -> void:
	for child in menu_layer.get_children():
		if child is Control: child.visible = true
	settings_panel.visible = false

func _hud_label(layer: CanvasLayer, pos: Vector2, text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.position = pos
	label.add_theme_font_size_override("font_size", 11)
	label.add_theme_color_override("font_color", Color("#fff4df"))
	layer.add_child(label)
	return label

func _process(delta: float) -> void:
	if plane == null or camera == null or not game_started or paused: return
	elapsed += delta
	var input: Vector2 = Vector2(Input.get_axis("roll_left", "roll_right"), Input.get_axis("pitch_down", "pitch_up"))
	if touch_active: input = Vector2(touch_axis.x, -touch_axis.y)
	_update_flight_audio(delta, input)
	var target_roll := -input.x * 0.42
	var target_pitch := input.y * 0.22
	plane.rotation.z = lerp(plane.rotation.z, target_roll, delta * 5.0)
	plane.rotation.x = lerp(plane.rotation.x, target_pitch, delta * 4.0)
	# Banked aircraft steering: horizontal drag changes heading, so the plane
	# can freely navigate across the whole stationary map instead of following a rail.
	plane.rotation.y += input.x * delta * 0.95
	var forward := Vector3(0, 0, -1).rotated(Vector3.RIGHT, plane.rotation.x).rotated(Vector3.UP, plane.rotation.y)
	var lift: float = clampf(airspeed * airspeed * 0.035, 1.5, 3.4)
	var gravity := Vector3.DOWN * 2.8
	var target_velocity := forward * airspeed + Vector3(0, lift, 0) + gravity
	velocity = velocity.lerp(target_velocity, 1.0 - exp(-delta * 2.6))
	plane.position += velocity * delta
	_check_ground_contact(input)
	var target := plane.position + Vector3(0, 1.35, 3.15)
	camera.position = camera.position.lerp(target, 1.0 - exp(-delta * 8.0))
	camera.look_at(plane.position + Vector3(0, 0, -5), Vector3.UP)
	if speed_label:
		speed_label.text = "SPEED  %.1f m/s" % velocity.length()

func _check_ground_contact(input: Vector2) -> void:
	var ground_y: float = _height(plane.position.x, plane.position.z)
	var clearance: float = plane.position.y - ground_y
	if clearance > 0.75: return
	plane.position.y = ground_y + 0.75
	var hard_impact: bool = velocity.y < -2.2 or abs(input.x) > 0.82 or abs(input.y) > 0.82
	velocity = Vector3.ZERO
	if hard_impact:
		_finish_flight("CRASHED")
	else:
		_finish_flight("LANDED")

func _update_flight_audio(delta: float, input: Vector2) -> void:
	if wind_playback == null or turn_playback == null: return
	audio_phase += delta
	var frames := clampi(int(delta * audio_mix_rate * 1.6), 160, 900)
	var speed_factor: float = clampf(velocity.length() / 14.0, 0.0, 1.0)
	var turn_factor: float = clampf(input.length(), 0.0, 1.0)
	for i in range(frames):
		var t := audio_phase + float(i) / audio_mix_rate
		# Layered filtered-like tones make a soft air rush without a bundled sample.
		var rush := sin(t * 93.0) * 0.12 + sin(t * 157.0) * 0.07 + sin(t * 241.0) * 0.04
		var wind_sample := rush * (0.16 + speed_factor * 0.30)
		wind_playback.push_frame(Vector2(wind_sample, wind_sample * 0.97))
		var bank := sin(t * 42.0) * turn_factor * 0.11
		var click := sin(t * (220.0 + turn_factor * 180.0)) * turn_factor * 0.035
		turn_playback.push_frame(Vector2(bank + click, -bank + click))

