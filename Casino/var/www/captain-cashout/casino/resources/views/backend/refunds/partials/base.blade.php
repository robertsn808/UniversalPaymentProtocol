<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.min_pay')</label>
		<input type="text" class="form-control" name="min_pay" placeholder="@lang('app.min_pay')" required value="{{ $edit ? $refund->min_pay : '' }}">
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.max_pay')</label>
		<input type="text" class="form-control" name="max_pay" placeholder="@lang('app.max_pay')" required value="{{ $edit ? $refund->max_pay : '' }}">
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.percent')</label>
		@php
			$percents = array_combine(\VanguardLTE\Refund::$values['percent'], \VanguardLTE\Refund::$values['percent']);
		@endphp
		<select name="percent" class="form-control">
			@foreach($percents as $key => $value)
				<option value="{{ $key }}" {{ $edit && $refund->percent == $key ? 'selected' : '' }}>
					{{ $value }}
				</option>
			@endforeach
		</select>
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.min_balance')</label>
		<input type="text" class="form-control" name="min_balance" placeholder="@lang('app.min_balance')" required value="{{ $edit ? $refund->min_balance : 0 }}">
	</div>
</div>

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.status')</label>
		<select name="status" id="status" class="form-control">
			<option value="0" {{ $edit && $refund->status == 0 ? 'selected' : '' }}>
				{{ __('app.disabled') }}
			</option>
			<option value="1" {{ $edit && $refund->status == 1 ? 'selected' : '' }}>
				{{ __('app.active') }}
			</option>
		</select>
	</div>
</div>