<ul class="list-group list-group-unbordered">
	<li class="list-group-item">
		@foreach([1, 3, 5, 7, 9, 10] as $index)
			<div class="row">
				@foreach(\VanguardLTE\Game::$values['random_keys'] as $random_key => $values)
						@php
							$key = 'lines_percent_config_bonus';
							$array_key = 'line_bonus[line' . $index . '][' . $random_key . ']';
							$value = $game->get_line_value($game->$key, 'line' . $index, $random_key, true);
						@endphp

						<div class="col-md-4">
							<div class="form-group">
								<label>L {{ $index }} - {{ $values[0] }}, {{ $values[1] }}</label>
								<select name="{{ $array_key }}" class="form-control" required>
									@foreach ($game->get_values('random_values', false, $edit ? $value : false) as $key => $option)
										<option value="{{ $key }}" {{ ($edit ? $value : '') == $key ? 'selected' : '' }}>{{ $option }}</option>
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
							$key = 'lines_percent_config_bonus_bonus';
							$array_key = 'line_bonus_bonus[line' . $index . '_bonus][' . $random_key . ']';
							$value = $game->get_line_value($game->$key, 'line' . $index . '_bonus', $random_key, true);
						@endphp

						<div class="col-md-4">
							<div class="form-group">
								<label>L {{ $index }} Bonus - {{ $values[0] }}, {{ $values[1] }}</label>
								<select name="{{ $array_key }}" class="form-control" required>
									@foreach ($game->get_values('random_values', false, $edit ? $value : false) as $key => $option)
										<option value="{{ $key }}" {{ ($edit ? $value : '') == $key ? 'selected' : '' }}>{{ $option }}</option>
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
		<div class="row">
			@foreach([1, 2, 3] as $index)
						@php
							$key = 'chanceFirepot' . $index;
						@endphp
						<div class="col-md-6">
							<div class="form-group">
								<label>ChanceFirepot {{ $index }}</label>
								<select name="{{ $key }}" class="form-control" required>
									@foreach ($game->get_values($key, true, $edit ? $game->$key : false) as $key => $option)
										<option value="{{ $key }}" {{ ($edit ? $game->$key : '') == $key ? 'selected' : '' }}>{{ $option }}</option>
									@endforeach
								</select>
							</div>
						</div>
						@php
							$key = 'fireCount' . $index;
						@endphp
						<div class="col-md-6">
							<div class="form-group">
								<label>FireCount {{ $index }}</label>
								<select name="{{ $key }}" class="form-control" required>
									@foreach ($game->get_values($key, true, $edit ? $game->$key : false) as $optionKey => $optionValue)
										<option value="{{ $optionKey }}" {{ ($edit ? $game->$key : '') == $optionKey ? 'selected' : '' }}>{{ $optionValue }}</option>
									@endforeach
								</select>
							</div>
						</div>
			@endforeach
		</div>

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