<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.name')</label>
		<input type="text" class="form-control" id="name" name="name" placeholder="@lang('app.name')" required value="{{ $edit ? $jackpot->name : '' }}">
	</div>
</div>
@if(auth()->user()->hasRole('admin'))
	<div class="col-md-6">
		<div class="form-group">
			<label>@lang('app.balance')</label>
			<input type="number" step="0.0000001" class="form-control" id="balance" name="balance" placeholder="0.00" @if(!auth()->user()->hasRole('admin'))disabled @endif value="{{ $edit ? $jackpot->balance : '' }}" >
		</div>
	</div>
@endif

@if(auth()->user()->hasPermission('jpgame.edit'))
	<div class="col-md-6">
		<div class="form-group">
			<label>@lang('app.start_balance')</label>
			<select name="start_balance" class="form-control">
				<option value="">---</option>
				@foreach(\VanguardLTE\JPG::$values['start_balance'] as $key => $value)
					<option value="{{ $key }}" {{ $edit && $jackpot->start_balance == $key ? 'selected' : '' }}>{{ $value }}</option>
				@endforeach
			</select>
		</div>
	</div>

	<div class="col-md-6">
		<div class="form-group">
			<label>@lang('app.trigger')</label>
			<select name="pay_sum" class="form-control">
				<option value="">---</option>
				@foreach(\VanguardLTE\JPG::$values['pay_sum'] as $key => $value)
					<option value="{{ $key }}" {{ $edit && $jackpot->pay_sum == $key ? 'selected' : '' }}>{{ $value }}</option>
				@endforeach
			</select>
		</div>
	</div>

	<div class="col-md-6">
		<div class="form-group">
			<label>@lang('app.percent')</label>
			@php
				$percents = array_combine(\VanguardLTE\JPG::$values['percent'], \VanguardLTE\JPG::$values['percent']);
			@endphp
			<select name="percent" class="form-control">
				<option value="">---</option>
				@foreach($percents as $key => $value)
					<option value="{{ $key }}" {{ old('percent', $jackpot->percent) == $key ? 'selected' : '' }}>{{ $value }}</option>
				@endforeach
			</select>
		</div>
	</div>
@endif

<div class="col-md-6">
	<div class="form-group">
		<label>@lang('app.user')</label>
		<select name="user_id" class="form-control select2" style="width: 100%;">
			<option value="">---</option>
			@foreach($users as $key => $user)
				<option value="{{ $key }}" {{ $edit && $jackpot->user_id == $key ? 'selected' : '' }}>{{ $user }}</option>
			@endforeach
		</select>
	</div>
</div>