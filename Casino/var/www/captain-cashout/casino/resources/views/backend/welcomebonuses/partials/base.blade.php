<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.sum')</label>
		<input type="number" step="0.0000001" class="form-control" name="sum" value="{{ $edit ? $welcome_bonus->sum : old('sum') }}" required>
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.type')</label>
		<select name="type" class="form-control" disabled>
			@foreach(\VanguardLTE\WelcomeBonus::$values['type'] as $key => $value)
				<option value="{{ $key }}" {{ ($edit ? $welcome_bonus->type : old('type')) == $key ? 'selected' : '' }}>{{ $value }}</option>
			@endforeach
		</select>
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.bonus')</label>
		@php
			$bonuses = array_combine(\VanguardLTE\WelcomeBonus::$values['bonus'], \VanguardLTE\WelcomeBonus::$values['bonus']);
		@endphp
		<select name="bonus" class="form-control">
			@foreach($bonuses as $key => $value)
				<option value="{{ $key }}" {{ ($edit ? $welcome_bonus->bonus : old('bonus')) == $key ? 'selected' : '' }}>{{ $value }}</option>
			@endforeach
		</select>
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.wager')</label>
		<select name="wager" class="form-control">
			@foreach(\VanguardLTE\WelcomeBonus::$values['wager'] as $key => $value)
				<option value="{{ $key }}" {{ ($edit ? $welcome_bonus->wager : old('wager')) == $key ? 'selected' : '' }}>{{ $value }}</option>
			@endforeach
		</select>
	</div>
</div>