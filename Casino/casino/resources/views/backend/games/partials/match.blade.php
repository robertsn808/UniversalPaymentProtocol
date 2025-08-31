<div class="row">

	<div class="col-md-4">
		<div class="form-group">
			<label for="title">@lang('app.gamebank')</label>
			<select name="gamebank" class="form-control" required>
				@foreach($game->gamebankNames as $key => $value)
					<option value="{{ $key }}" {{ $edit && $game->gamebank == $key ? 'selected' : '' }}>{{ $value }}</option>
				@endforeach
			</select>
		</div>
	</div>

	<div class="col-md-4">
		@if (!$edit || $game->rezerv !== '')
			<div class="form-group">
				<label for="rezerv">@lang('app.doubling')</label>
				<select name="rezerv" class="form-control" required>
					@foreach($game->get_values('rezerv') as $key => $value)
						<option value="{{ $key }}" {{ $edit && $game->rezerv == $key ? 'selected' : '' }}>{{ $value }}</option>
					@endforeach
				</select>
			</div>
		@endif
	</div>
	<div class="col-md-4">
		@if (!$edit || $game->cask !== '')
			<div class="form-group">
				<label for="cask">@lang('app.health')</label>
				<select name="cask" class="form-control" required>
					@foreach($game->get_values('cask') as $key => $value)
						<option value="{{ $key }}" {{ $edit && $game->cask == $key ? 'selected' : '' }}>{{ $value }}</option>
					@endforeach
				</select>
			</div>
		@endif
	</div>


</div>

<div class="row">
	<div class="col-md-4">
		<div class="form-group">
			<label for="title">@lang('app.jpg')</label>
			<select name="jpg_id" class="form-control">
				<option value="">{{ '---' }}</option>
				@foreach($jpgs as $key => $value)
					<option value="{{ $key }}" {{ $edit && $game->jpg_id == $key ? 'selected' : '' }}>{{ $value }}</option>
				@endforeach
			</select>
		</div>
	</div>

	<div class="col-md-4">
		<div class="form-group">
			<label for="title">@lang('app.labels')</label>
			<select name="label" class="form-control">
				<option value="">{{ '---' }}</option>
				@foreach($game->labels as $key => $value)
					<option value="{{ $key }}" {{ $edit && $game->label == $key ? 'selected' : '' }}>{{ $value }}</option>
				@endforeach
			</select>
		</div>
	</div>
</div>


<ul class="list-group list-group-unbordered">
	<li class="list-group-item">
		@foreach([1, 3, 5, 7, 9, 10] as $index)
			<div class="row">
				@foreach(\VanguardLTE\Game::$values['random_keys'] as $random_key => $values)
						@php
							$key = 'lines_percent_config_spin';
							$array_key = 'line_spin[line' . $index . '][' . $random_key . ']';
							$value = $game->get_line_value($game->$key, 'line' . $index, $random_key, true);
						@endphp

						<div class="col-md-4">
							<div class="form-group">
								<label>L {{ $index }} - {{ $values[0] }}, {{ $values[1] }}</label>
								<select name="{{ $array_key }}" class="form-control" required>
									@foreach($game->get_values('random_values', false, $edit ? $value : false) as $key => $val)
										<option value="{{ $key }}" {{ $edit && $value == $key ? 'selected' : '' }}>{{ $val }}</option>
									@endforeach
								</select>
							</div>
						</div>
				@endforeach
			</div>
		@endforeach
	</li>
</ul>

<ul class="list-group list-group-unbordered">
	<li class="list-group-item">
		@foreach([1, 3, 5, 7, 9, 10] as $index)
			<div class="row">
				@foreach(\VanguardLTE\Game::$values['random_keys'] as $random_key => $values)
						@php
							$key = 'lines_percent_config_spin_bonus';
							$array_key = 'line_spin_bonus[line' . $index . '_bonus][' . $random_key . ']';
							$value = $game->get_line_value($game->$key, 'line' . $index . '_bonus', $random_key, true);
						@endphp

						<div class="col-md-4">
							<div class="form-group">
								<label>L {{ $index }} Bonus - {{ $values[0] }}, {{ $values[1] }}</label>
								<select name="{{ $array_key }}" class="form-control" required>
									@foreach($game->get_values('random_values', false, $edit ? $value : false) as $key => $val)
										<option value="{{ $key }}" {{ $edit && $value == $key ? 'selected' : '' }}>{{ $val }}</option>
									@endforeach
								</select>
							</div>
						</div>
				@endforeach
			</div>
		@endforeach
	</li>
</ul>







<div class="row">

	@if ($edit)
		<div class="col-md-12 mt-2">
			<button type="submit" class="btn btn-primary" id="update-details-btn">
				@lang('app.edit_game')
			</button>
		</div>
	@endif
</div>