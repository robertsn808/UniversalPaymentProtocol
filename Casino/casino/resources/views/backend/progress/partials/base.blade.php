<div class="col-md-6">
	<div class="form-group">
		<label for="nominal">@lang('app.rating')</label>
		<input type="number" step="0.0000001" class="form-control" id="rating" name="rating" placeholder="" required value="{{ $edit ? $progress->rating : '' }}" disabled>
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label for="nominal">@lang('app.sum')</label>
		<input type="number" step="0.0000001" class="form-control" id="sum" name="sum" placeholder="" required value="{{ $edit ? $progress->sum : '' }}">
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label for="status">@lang('app.type')</label>
		<select name="type" id="type" class="form-control">
			<option value="one_pay" {{ $edit && $progress->type == 'one_pay' ? 'selected' : '' }}>
				{{ __('app.one_pay') }}
			</option>
			<option value="sum_pay" {{ !$edit || $progress->type == 'sum_pay' ? 'selected' : '' }}>
				{{ __('app.sum_pay') }}
			</option>
		</select>
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label for="nominal">@lang('app.spins')</label>
		<input type="number" step="0.0000001" class="form-control" id="spins" name="spins" placeholder="" required value="{{ $edit ? $progress->spins : '' }}">
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label for="nominal">@lang('app.bet')</label>
		<input type="number" step="0.0000001" class="form-control" id="bet" name="bet" placeholder="" required value="{{ $edit ? $progress->bet : '' }}">
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label for="bonus">@lang('app.bonus')</label>
		<input type="number" step="0.0000001" class="form-control" id="bonus" name="bonus" placeholder="" required value="{{ $edit ? $progress->bonus : '' }}">
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.day')</label>
		@php
			$days = array_combine(\VanguardLTE\Progress::$values['day'], \VanguardLTE\Progress::$values['day']);
		@endphp
		<select name="day" class="form-control">
			@foreach ($days as $value => $label)
				<option value="{{ $value }}" {{ $edit && $progress->day == $value ? 'selected' : '' }}>
					{{ $label }}
				</option>
			@endforeach
		</select>
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label for="min">@lang('app.min')</label>
		<input type="number" step="0.0000001" class="form-control" id="min" name="min" required value="{{ $edit ? $progress->min : '' }}">
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label for="max">@lang('app.max')</label>
		<input type="number" step="0.0000001" class="form-control" id="max" name="max" required value="{{ $edit ? $progress->max : '' }}">
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.percent')</label>
		@php
			$percents = array_combine(\VanguardLTE\Progress::$values['percent'], \VanguardLTE\Progress::$values['percent']);
		@endphp
		<select name="percent" class="form-control">
			@foreach ($percents as $value => $label)
				<option value="{{ $value }}" {{ $edit && $progress->percent == $value ? 'selected' : '' }}>
					{{ $label }}
				</option>
			@endforeach
		</select>
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label for="nominal">@lang('app.min_balance')</label>
		<input type="number" step="0.0000001" class="form-control" id="min_balance" name="min_balance" required value="{{ $edit ? $progress->min_balance : '' }}">
	</div>
</div>
<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.wager')</label>
		<select name="wager" class="form-control">
			@foreach (\VanguardLTE\Progress::$values['wager'] as $value => $label)
				<option value="{{ $value }}" {{ $edit && $progress->wager == $value ? 'selected' : '' }}>
					{{ $label }}
				</option>
			@endforeach
		</select>
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.days_active')</label>
		@php
			$days_active = array_combine(\VanguardLTE\Progress::$values['days_active'], \VanguardLTE\Progress::$values['days_active']);
		@endphp
		<select name="days_active" class="form-control">
			@foreach ($days_active as $value => $label)
				<option value="{{ $value }}" {{ $edit && $progress->days_active == $value ? 'selected' : '' }}>
					{{ $label }}
				</option>
			@endforeach
		</select>
	</div>
</div>