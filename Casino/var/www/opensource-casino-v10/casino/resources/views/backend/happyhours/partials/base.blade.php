<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.multiplier')</label>
		@php
			$multipliers = array_combine(\VanguardLTE\HappyHour::$values['multiplier'], \VanguardLTE\HappyHour::$values['multiplier']);
		@endphp
		<select name="multiplier" class="form-control">
			@foreach($multipliers as $key => $value)
				<option value="{{ $key }}" {{ $edit && $happyhour->multiplier == $key ? 'selected' : '' }}>{{ $value }}</option>
			@endforeach
		</select>
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.wager')</label>
		<select name="wager" class="form-control">
			@foreach(\VanguardLTE\HappyHour::$values['wager'] as $key => $value)
				<option value="{{ $key }}" {{ $edit && $happyhour->wager == $key ? 'selected' : '' }}>{{ $value }}</option>
			@endforeach
		</select>
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.time')</label>
		@php
			$times = array_combine(\VanguardLTE\HappyHour::$values['time'], \VanguardLTE\HappyHour::$values['time']);
		@endphp
		<select name="time" class="form-control">
			@foreach($times as $key => $value)
				<option value="{{ $key }}" {{ $edit && $happyhour->time == $key ? 'selected' : '' }}>{{ $value }}</option>
			@endforeach
		</select>
	</div>
</div>