<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.days')</label>
		@php
			$days = array_combine(\VanguardLTE\SMSBonus::$values['days'], \VanguardLTE\SMSBonus::$values['days']);
		@endphp
		<select name="days" class="form-control">
			@foreach($days as $key => $value)
				<option value="{{ $key }}" {{ ($edit ? $sms_bonus->days : old('days')) == $key ? 'selected' : '' }}>{{ $value }}</option>
			@endforeach
		</select>
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.bonus')</label>
		@php
			$bonuses = array_combine(\VanguardLTE\SMSBonus::$values['bonus'], \VanguardLTE\SMSBonus::$values['bonus']);
		@endphp
		<select name="bonus" class="form-control">
			@foreach($bonuses as $key => $value)
				<option value="{{ $key }}" {{ ($edit ? $sms_bonus->bonus : old('bonus')) == $key ? 'selected' : '' }}>{{ $value }}</option>
			@endforeach
		</select>
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.wager')</label>
		<select name="wager" class="form-control">
			@foreach(\VanguardLTE\SMSBonus::$values['wager'] as $key => $value)
				<option value="{{ $key }}" {{ ($edit ? $sms_bonus->wager : old('wager')) == $key ? 'selected' : '' }}>{{ $value }}</option>
			@endforeach
		</select>
	</div>
</div>